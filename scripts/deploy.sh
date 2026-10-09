#!/usr/bin/env bash
# Zero-downtime deploy for DNMS (blue/green on ports 3000/3001 behind nginx). Runs ON the server.
#
#   scp scripts/deploy.sh dnms:/root/dnms-deploy/deploy.sh
#   ssh dnms 'nohup bash /root/dnms-deploy/deploy.sh deploy > /root/dnms-deploy/logs/last.log 2>&1 &'
#   ssh dnms 'tail -f /root/dnms-deploy/logs/last.log'      # follow it (Ctrl+C stops only the tail)
#   ...deploy.sh deploy <git-ref> | rollback | status       # default ref: origin/main
#
# Each release is built in its own folder while the live one keeps serving; nginx only switches
# once the new one answers. Migrations run before the switch, so they must stay backward
# compatible with the version that is still live.
set -euo pipefail

BASE=/root/dnms-deploy
REPO_URL=https://github.com/digitallynextgit/DNMS.git
PORTS=(3000 3001)
UPSTREAM=/etc/nginx/conf.d/dnms-upstream.conf
KEEP=3
BUILD_MEM_MB=3072

export NVM_DIR=/root/.nvm
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh" >/dev/null

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\nDEPLOY FAILED: %s\n' "$*" >&2; exit 1; }

mkdir -p "$BASE/releases" "$BASE/shared" "$BASE/logs"
exec 9>"$BASE/.lock"
flock -n 9 || die "another deploy is running"

active_port() { grep -oE '127\.0\.0\.1:[0-9]+' "$UPSTREAM" | cut -d: -f2; }
other_port() { [ "$1" = "${PORTS[0]}" ] && echo "${PORTS[1]}" || echo "${PORTS[0]}"; }
slot() { echo "dnms-$1"; }
current_release() { readlink -f "$BASE/current" 2>/dev/null || true; }
# Newest first; names start with a timestamp.
list_releases() { ls -1d "$BASE"/releases/*/ 2>/dev/null | sort -r; }

# A build that fails leaves no half-made release behind.
PENDING=""
trap '[ -n "$PENDING" ] && rm -rf "$PENDING"' EXIT

healthy() {
  local port=$1 code
  for _ in $(seq 1 90); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$port/login" || true)
    [ "$code" = 200 ] && return 0
    sleep 2
  done
  return 1
}

switch_nginx() {
  local port=$1
  cp "$UPSTREAM" "$UPSTREAM.bak"
  printf 'upstream dnms_app {\n    server 127.0.0.1:%s;\n}\n' "$port" >"$UPSTREAM"
  if ! nginx -t -q 2>/dev/null; then
    mv "$UPSTREAM.bak" "$UPSTREAM"
    die "nginx config test failed - nothing switched"
  fi
  systemctl reload nginx
}

# Start `release` on the idle port, check it, switch nginx, then stop the old process.
promote() {
  local release=$1 old new
  old=$(active_port)
  new=$(other_port "$old")

  log "Starting $(basename "$release") on port $new"
  pm2 delete "$(slot "$new")" >/dev/null 2>&1 || true
  PORT=$new pm2 start pnpm --name "$(slot "$new")" --cwd "$release" --time -- start >/dev/null

  log "Waiting for port $new to answer"
  if ! healthy "$new"; then
    pm2 logs "$(slot "$new")" --lines 40 --nostream || true
    pm2 delete "$(slot "$new")" >/dev/null 2>&1 || true
    die "new release did not come up - port $old is still live, nothing changed"
  fi

  log "Switching nginx $old -> $new"
  switch_nginx "$new"
  ln -sfn "$release" "$BASE/current"

  # Let in-flight requests on the old port finish before stopping it.
  sleep 10
  pm2 delete "$(slot "$old")" >/dev/null 2>&1 || true
  pm2 delete dnms >/dev/null 2>&1 || true # the pre-blue/green process, if still around
  pm2 save >/dev/null
  log "Live: $(basename "$release") on port $new"
}

deploy() {
  local ref=${1:-origin/main} sha release
  if [ ! -d "$BASE/repo/.git" ]; then
    log "Cloning $REPO_URL"
    git clone -q "$REPO_URL" "$BASE/repo"
  fi
  git -C "$BASE/repo" fetch -q --prune origin
  sha=$(git -C "$BASE/repo" rev-parse --short "$ref") || die "unknown ref $ref"
  release="$BASE/releases/$(date +%Y%m%d-%H%M%S)-$sha"
  log "Deploying $ref ($sha: $(git -C "$BASE/repo" log -1 --format=%s "$sha"))"

  PENDING=$release
  mkdir -p "$release"
  git -C "$BASE/repo" archive "$sha" | tar -x -C "$release"
  ln -s "$BASE/shared/.env" "$release/.env"
  ln -s "$BASE/shared/secrets" "$release/secrets"
  cd "$release"

  log "Installing dependencies"
  pnpm install --frozen-lockfile --prefer-offline --reporter=append-only

  log "Building (live site keeps serving)"
  NODE_OPTIONS="--max-old-space-size=$BUILD_MEM_MB" pnpm build

  log "Applying database migrations"
  pnpm exec prisma migrate deploy

  promote "$release"
  PENDING=""

  log "Removing old releases (keeping $KEEP)"
  local cur
  cur=$(current_release)
  list_releases | tail -n +$((KEEP + 1)) | while read -r dir; do
    [ "$(readlink -f "$dir")" = "$cur" ] || rm -rf "$dir"
  done
}

rollback() {
  local cur prev
  cur=$(current_release)
  prev=$(list_releases | while read -r d; do
    d=$(readlink -f "$d")
    [ "$d" != "$cur" ] && [ -d "$d/.next" ] && echo "$d" && break
  done)
  [ -n "$prev" ] || die "no previous release to roll back to"
  log "Rolling back to $(basename "$prev")"
  promote "$prev"
}

status() {
  echo "Live port:    $(active_port)"
  echo "Live release: $(basename "$(current_release)" 2>/dev/null)"
  echo "Releases:"
  list_releases
  pm2 list
  free -m
}

case "${1:-deploy}" in
  deploy) deploy "${2:-}" ;;
  rollback) rollback ;;
  status) status ;;
  *) die "usage: deploy [ref] | rollback | status" ;;
esac
