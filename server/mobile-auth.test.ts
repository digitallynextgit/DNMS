import { beforeEach, describe, expect, it, vi } from "vitest"

// =============================================================================
// The two invariants in server/mobile-auth.ts that are not visible by reading
// one function, and that both fail SILENTLY:
//
//   1. ONE CLOCK. mobile_sessions.created_at and users.password_changed_at are
//      COMPARED, and the comparison decides whether a session is alive. The
//      column's own DEFAULT is CURRENT_TIMESTAMP - the DATABASE clock - while
//      passwordChangedAt is written `new Date()` in the application. Mixing them
//      makes the session the password route mints DEAD ON ARRIVAL whenever
//      Postgres is a moment behind, and that route's failure mode is a permanent
//      lockout. The fake database below therefore has its OWN clock, and it is
//      set deliberately behind: nothing here passes unless issueSession() sends
//      createdAt itself.
//
//   2. A REVOKE IS TWO WRITES. Revoking kills the session row, which is what
//      every check reads; the mobile_tokens rows have to be stamped beside it or
//      the table reads "nothing was ever revoked" to whoever queries it during
//      an incident. Only the first write changes behaviour, which is exactly why
//      the second one goes missing and why it is asserted here.
//
//   3. A ROTATION IS NOT A REVOCATION. rotate() spends the refresh token and
//      LEAVES the superseded access token alive for the rest of its 15 minutes.
//      That is a decision, argued at length on rotate() itself, and the third
//      block below pins it - so anyone who "tightens" it has to delete a passing
//      test and therefore has to read the argument first. An undocumented
//      security property is one nobody can rely on; a documented one that no
//      test holds is one that changes by accident.
//
// server-only and every module that reaches Prisma or next-auth are mocked, the
// way features/projects/server/workbook-team-access.test.ts does it, so this
// runs in the pure-module suite with no database. What is NOT mocked is the
// logic under test: the real issueSession(), rotate(), revoke(),
// revokeSessionById(), revokeAllForUser() and resolveMobilePrincipal() run here,
// against real generateToken()/sha256Hex().
// =============================================================================

vi.mock("server-only", () => ({}))

/**
 * How far behind the application the FAKE DATABASE's clock runs. This is the
 * whole point of the file: a column filled by the database default gets this
 * clock, a column the application sends gets Date.now(). 30 seconds is absurd
 * for real NTP and deliberately so - the bug needs only milliseconds, and a
 * large skew makes a failure unmistakable rather than flaky.
 */
const DB_SKEW_MS = 30_000
const dbNow = () => new Date(Date.now() - DB_SKEW_MS)

/**
 * A row in one of the fake tables. Deliberately untyped: these tables hold two
 * different Prisma models and the mock writes whatever `data` the code under
 * test sends, which is the half of this file that has to stay honest - a typed
 * fake would stop compiling the moment the real call changed, which is exactly
 * when the test needs to keep running and fail instead.
 */
type Row = Record<string, unknown>

/** A timestamp column off a fake row. The one cast `Row` costs, kept in one place. */
const stamp = (value: unknown): number => (value as Date).getTime()

/** The fake tables, plus what the mocked identity layer answers. */
const state = {
  sessions: [] as Row[],
  tokens: [] as Row[],
  /** Captured `data` of the last mobileSession.create - asserted on directly. */
  lastSessionCreate: null as Row | null,
  membership: {
    id: "mem_1",
    kind: "STAFF",
    tenantId: "ten_1",
    tenantSlug: "digitally-next",
    tenantName: "Digitally Next",
    profileId: "emp_1",
    mustChangePassword: false,
    passwordChangedAt: null as Date | null,
  },
}

let seq = 0
const nextId = (prefix: string) => `${prefix}_${++seq}`

/**
 * Enough of a Prisma `where` to serve this file: scalar equality (null
 * included, which is what `revokedAt: null` relies on) and `{ in: [...] }`.
 * Anything else would silently match everything, so it throws instead.
 */
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want !== null && typeof want === "object" && !(want instanceof Date)) {
      const list = (want as { in?: unknown[] }).in
      if (Array.isArray(list)) return list.includes(row[key])
      throw new Error(`mobile-auth.test: unsupported filter on ${key}: ${JSON.stringify(want)}`)
    }
    return row[key] === want
  })
}

function updateMany(table: Row[], where: Row, data: Row) {
  let count = 0
  for (const row of table) {
    if (!matches(row, where)) continue
    Object.assign(row, data)
    count += 1
  }
  return { count }
}

vi.mock("@/server/db", () => ({
  db: {
    // issueTokens() hands an ARRAY of already-started promises, so this is the
    // honest stand-in for the sequential form.
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),

    user: {
      findUnique: async () => ({ email: "riya@digitallynext.test", name: "Riya Shah" }),
    },

    mobileSession: {
      create: async ({ data }: { data: Row }) => {
        state.lastSessionCreate = data
        const row: Row = {
          id: nextId("sess"),
          lastSeenAt: null,
          revokedAt: null,
          revokedReason: null,
          ...data,
          // EXACTLY what Postgres does with DEFAULT CURRENT_TIMESTAMP: an
          // explicit value wins, an absent one is filled from the DB's clock.
          createdAt: data.createdAt ?? dbNow(),
        }
        state.sessions.push(row)
        return row
      },
      findUnique: async ({ where }: { where: Row }) =>
        state.sessions.find((s) => s.id === where.id) ?? null,
      findMany: async ({ where, select }: { where: Row; select?: Row }) =>
        state.sessions.filter((s) => matches(s, where)).map((s) => (select ? { id: s.id } : s)),
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = state.sessions.find((s) => s.id === where.id)
        if (row) Object.assign(row, data)
        return row
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) =>
        updateMany(state.sessions, where, data),
    },

    mobileToken: {
      create: async ({ data }: { data: Row }) => {
        const row: Row = {
          id: nextId("tok"),
          usedAt: null,
          revokedAt: null,
          // A pure record, never compared with an app timestamp - so the DB clock
          // is correct here and the asymmetry with mobile_sessions is the point.
          createdAt: dbNow(),
          ...data,
        }
        state.tokens.push(row)
        return row
      },
      findUnique: async ({ where }: { where: Row }) => {
        const row = state.tokens.find((t) => matches(t, where))
        if (!row) return null
        return { ...row, session: state.sessions.find((s) => s.id === row.sessionId) ?? null }
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) =>
        updateMany(state.tokens, where, data),
    },
  },
}))

vi.mock("@/server/tenant-context", () => ({
  runUnscoped: (_reason: string, fn: () => Promise<unknown>) => fn(),
  runWithTenant: (_tenant: unknown, fn: () => Promise<unknown>) => fn(),
}))

vi.mock("@/server/delegated-session", () => ({
  runAsDelegate: (_session: unknown, fn: () => Promise<unknown>) => fn(),
}))

vi.mock("@/server/identity", () => ({
  loadMembershipIfStillValid: async (id: string) =>
    id === state.membership.id ? state.membership : null,
}))

vi.mock("@/server/auth", () => ({
  getUserWithPermissions: async (employeeId: string) => ({
    employee: {
      id: employeeId,
      employeeNo: "DN-0001",
      firstName: "Riya",
      lastName: "Shah",
      profilePhoto: null,
    },
    roles: ["EMPLOYEE"],
    permissions: ["attendance.read"],
  }),
}))

const {
  issueSession,
  resolveMobilePrincipal,
  revoke,
  revokeAllForUser,
  revokeSessionById,
  rotate,
} = await import("./mobile-auth")

// -----------------------------------------------------------------------------

const IDENTITY = {
  id: "emp_1",
  email: "riya@digitallynext.test",
  name: "Riya Shah",
  kind: "employee" as const,
  userId: "usr_1",
  membershipId: "mem_1",
  tenantId: "ten_1",
  tenantSlug: "digitally-next",
  mustChangePassword: false,
}

const DEVICE = { deviceId: "dev-abc", platform: "ios", deviceName: "iPhone 15 Pro" }

const withBearer = (token: string) =>
  new Request("https://dnms.test/api/mobile/v1/me", {
    headers: { authorization: `Bearer ${token}` },
  })

const sessionRow = (id: string) => state.sessions.find((s) => s.id === id) as Row
const tokensOf = (sessionId: string) => state.tokens.filter((t) => t.sessionId === sessionId)

beforeEach(() => {
  state.sessions.length = 0
  state.tokens.length = 0
  state.lastSessionCreate = null
  state.membership.passwordChangedAt = null
  state.membership.kind = "STAFF"
})

// -----------------------------------------------------------------------------
// 1. One clock
// -----------------------------------------------------------------------------

describe("issueSession() timestamps the session from the application clock", () => {
  it("sends createdAt explicitly instead of leaving it to the column default", () => {
    // The assertion is on the WRITE, not on the row: a value the database filled
    // in would still look like a Date afterwards, which is how this stayed
    // invisible. Only an explicit createdAt in `data` rules the DB clock out.
    return issueSession(IDENTITY, DEVICE).then((issued) => {
      expect(state.lastSessionCreate?.createdAt).toBeInstanceOf(Date)
      expect(issued.session.createdAt.getTime()).toBeGreaterThan(dbNow().getTime())
    })
  })

  it("mints a session that is NOT older than a password change made a moment earlier", async () => {
    // The password route in order: setOwnPassword() writes passwordChangedAt with
    // the app's clock, revokeAllForUser() kills every device, then issueSession()
    // mints the replacement. If created_at came from a database running behind,
    // the replacement would be judged "issued before the password change".
    state.membership.passwordChangedAt = new Date()
    await revokeAllForUser(IDENTITY.userId, "password_changed")

    const issued = await issueSession(IDENTITY, DEVICE)

    expect(issued.session.createdAt.getTime()).toBeGreaterThanOrEqual(
      state.membership.passwordChangedAt.getTime(),
    )
  })

  it("so the pair the password route returns still works on the very next request", async () => {
    state.membership.passwordChangedAt = new Date()
    const issued = await issueSession(IDENTITY, DEVICE)

    const principal = await resolveMobilePrincipal(withBearer(issued.accessToken))

    expect(principal, "the replacement session was revoked on its first request").not.toBeNull()
    expect(principal?.employeeId).toBe("emp_1")
    expect(sessionRow(issued.session.id).revokedAt).toBeNull()
  })

  it("and the bug it prevents is real: a DB-clock created_at is dead on arrival", async () => {
    // The negative control, so the three tests above cannot pass vacuously. This
    // back-dates the row by the skew - precisely what DEFAULT CURRENT_TIMESTAMP
    // would have written on a database 30 seconds behind - and changes nothing
    // else.
    state.membership.passwordChangedAt = new Date()
    const issued = await issueSession(IDENTITY, DEVICE)
    sessionRow(issued.session.id).createdAt = dbNow()

    expect(await resolveMobilePrincipal(withBearer(issued.accessToken))).toBeNull()
    expect(sessionRow(issued.session.id).revokedReason).toBe("password_changed")
  })
})

// -----------------------------------------------------------------------------
// 2. A revoke is two writes
// -----------------------------------------------------------------------------

describe("revoking a mobile session also marks its tokens dead", () => {
  it("revokeSessionById() stamps the session and both of its tokens", async () => {
    const issued = await issueSession(IDENTITY, DEVICE)
    expect(tokensOf(issued.session.id)).toHaveLength(2)

    await revokeSessionById(issued.session.id, "signed_out")

    const session = sessionRow(issued.session.id)
    expect(session.revokedAt).toBeInstanceOf(Date)
    expect(session.revokedReason).toBe("signed_out")
    for (const token of tokensOf(issued.session.id)) {
      expect(token.revokedAt, `${token.kind} token still reads as live`).toBeInstanceOf(Date)
      // One timestamp for the whole revoke, so the ledger can be read as an event.
      expect(stamp(token.revokedAt)).toBe(stamp(session.revokedAt))
    }
  })

  it("revoke(refreshToken) goes through the same path rather than its own", async () => {
    const issued = await issueSession(IDENTITY, DEVICE)

    await revoke(issued.refreshToken)

    expect(sessionRow(issued.session.id).revokedReason).toBe("signed_out")
    expect(tokensOf(issued.session.id).every((t) => t.revokedAt)).toBe(true)
  })

  it("revoke() with no token writes nothing - RFC 7009 says succeed, not act", async () => {
    const issued = await issueSession(IDENTITY, DEVICE)

    await revoke("")
    await revoke("dnms_mr_never-issued")

    expect(sessionRow(issued.session.id).revokedAt).toBeNull()
    expect(tokensOf(issued.session.id).some((t) => t.revokedAt)).toBe(false)
  })

  it("revokeAllForUser() stamps the tokens of every session it killed", async () => {
    const first = await issueSession(IDENTITY, { ...DEVICE, deviceId: "dev-old" })
    const second = await issueSession(IDENTITY, { ...DEVICE, deviceId: "dev-new" })

    const count = await revokeAllForUser(IDENTITY.userId, "password_changed")

    expect(count).toBe(2)
    for (const id of [first.session.id, second.session.id]) {
      expect(sessionRow(id).revokedReason).toBe("password_changed")
      expect(
        tokensOf(id).every((t) => t.revokedAt),
        `${id} kept live tokens`,
      ).toBe(true)
    }
  })

  it("revokeAllForUser() leaves another person's devices and tokens alone", async () => {
    const mine = await issueSession(IDENTITY, DEVICE)
    const theirs = await issueSession(
      { ...IDENTITY, userId: "usr_2" },
      { ...DEVICE, deviceId: "dev-xyz" },
    )

    const count = await revokeAllForUser("usr_1", "password_changed")

    expect(count).toBe(1)
    expect(sessionRow(mine.session.id).revokedAt).toBeInstanceOf(Date)
    expect(sessionRow(theirs.session.id).revokedAt).toBeNull()
    // The companion write is keyed on the ids that were actually revoked, so this
    // is the assertion that catches a sweep written as "every token of this user".
    expect(tokensOf(theirs.session.id).some((t) => t.revokedAt)).toBe(false)
  })

  it("revokeAllForUser() with nothing live returns 0 and touches no token", async () => {
    const issued = await issueSession(IDENTITY, DEVICE)
    await revokeSessionById(issued.session.id, "signed_out")
    const stamped = tokensOf(issued.session.id).map((t) => stamp(t.revokedAt))

    expect(await revokeAllForUser(IDENTITY.userId, "password_changed")).toBe(0)

    // Already-dead tokens keep their ORIGINAL timestamp: `revokedAt: null` in the
    // companion write is what makes the ledger record when a token died, not when
    // it was last swept.
    expect(tokensOf(issued.session.id).map((t) => stamp(t.revokedAt))).toEqual(stamped)
  })
})

// -----------------------------------------------------------------------------
// 3. A rotation is not a revocation
// -----------------------------------------------------------------------------

describe("rotate() supersedes the access token without revoking it", () => {
  const accessTokensOf = (sessionId: string) =>
    tokensOf(sessionId).filter((t) => t.kind === "access")

  it("spends the refresh token it was given - the rotation itself works", async () => {
    const first = await issueSession(IDENTITY, DEVICE)

    const second = await rotate(first.refreshToken)

    // A new pair, and the old refresh token is marked spent. This is the control: the
    // assertions below are about what rotate() DELIBERATELY leaves alone, so they are
    // worthless unless it is doing its own job.
    expect(second.accessToken).not.toBe(first.accessToken)
    expect(second.refreshToken).not.toBe(first.refreshToken)
    const spent = tokensOf(first.session.id).filter((t) => t.usedAt)
    expect(spent).toHaveLength(1)
    expect(spent[0]?.kind).toBe("refresh")
  })

  it("leaves the PREVIOUS access token answering requests - measured over real HTTP", async () => {
    const first = await issueSession(IDENTITY, DEVICE)
    const second = await rotate(first.refreshToken)

    // Both tokens resolve the same person. This is exactly what the live smoke found: after a
    // successful refresh the previous access token still returned 200 on /me. It is pinned here
    // as the documented behaviour, NOT as an aspiration - read the block on rotate() before
    // changing it, because the app's 401 path spends a refresh token rather than re-reading the
    // keychain, and making this fail turns one stale token into a cascade of rotations.
    const old = await resolveMobilePrincipal(withBearer(first.accessToken))
    const fresh = await resolveMobilePrincipal(withBearer(second.accessToken))

    expect(old, "the superseded access token stopped working - see rotate()'s note").not.toBeNull()
    expect(fresh).not.toBeNull()
    expect(old?.sessionId).toBe(fresh?.sessionId)
  })

  it("writes no revoked_at on any access token of the session", async () => {
    const first = await issueSession(IDENTITY, DEVICE)
    await rotate(first.refreshToken)

    // The direct form of the same statement, and the one a tightening would flip: two live access
    // rows, neither stamped. Asserted on the TABLE rather than on a request, because a sweep
    // written as `{sessionId, kind:"access"}` would also catch the pair just minted - the new
    // access token would be dead on arrival and every screen would 401 at once.
    const access = accessTokensOf(first.session.id)
    expect(access).toHaveLength(2)
    expect(access.filter((t) => t.revokedAt)).toEqual([])
  })

  it("and a REAL revoke kills the just-rotated pair on the next call", async () => {
    // Why the test above is acceptable rather than a hole: nothing about rotation weakens the
    // revocation the opaque-token design was actually chosen for. One call, and both generations
    // of access token are dead - which is the property the 15-minute tail borrows its safety from.
    const first = await issueSession(IDENTITY, DEVICE)
    const second = await rotate(first.refreshToken)

    await revokeSessionById(first.session.id, "signed_out")

    expect(await resolveMobilePrincipal(withBearer(first.accessToken))).toBeNull()
    expect(await resolveMobilePrincipal(withBearer(second.accessToken))).toBeNull()
    expect(tokensOf(first.session.id).every((t) => t.revokedAt)).toBe(true)
  })

  it("and a reuse past the race window revokes the session instead of issuing", async () => {
    // The other half of the three-tier reuse response, which is where rotate() DOES revoke. It is
    // here so the pair of behaviours is readable in one place: a spent token is evidence, a
    // superseded one is not.
    const first = await issueSession(IDENTITY, DEVICE)
    await rotate(first.refreshToken)

    // Back-date the spent row past REFRESH_RACE_MS (60s), which is what a genuine replay looks
    // like as opposed to ten screens racing on a cold start.
    const used = tokensOf(first.session.id).find((t) => t.usedAt)
    if (used) used.usedAt = new Date(Date.now() - 61_000)

    await expect(rotate(first.refreshToken)).rejects.toThrow(/signed out/i)
    expect(sessionRow(first.session.id).revokedReason).toBe("refresh_token_reused")
  })
})
