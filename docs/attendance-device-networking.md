# Attendance device networking

How DNMS talks to the Hikvision terminal, why manual Sync fails from the VPS,
and the runbook to make it work from anywhere.

---

## The two directions

There are two independent paths, and they fail for different reasons.

| Path              | Direction     | Who initiates | Works from                   |
| ----------------- | ------------- | ------------- | ---------------------------- |
| **Realtime push** | device → DNMS | the terminal  | anywhere (outbound HTTPS)    |
| **Pull sync**     | DNMS → device | the server    | only with a route to the LAN |

### Realtime push (the live path)

The terminal POSTs each punch to `/api/attendance/hook/<secret>`. This is an
**outbound** HTTPS call from the office, which every firewall already permits —
no port forwarding, no static IP, nothing exposed inbound.

Set up under **Configuration → Network → Advanced → HTTP Listening** (some
firmware: Event → HTTP Host Notification). The Devices page shows the exact URL
and whether pushes are arriving (`lastPushAt`).

Requires `ATTENDANCE_HOOK_SECRET` set on the server and `APP_URL` pointing at
the public origin.

### Pull sync (Sync / Test / full backfill)

**The Sync button runs on the SERVER, not in your browser.** Clicking it does:

```
browser → POST https://dnms.digitallynext.com/api/attendance/devices/<id>/sync/stream
            ↓
          VPS → http://192.168.29.234:80/ISAPI/...
```

So the network that matters is the **server's**, not yours. Sitting in the
office on the office wifi does not help if the app you are using is the VPS —
the VPS is still in a datacenter with no route to `192.168.29.0/24`.

This is why pull sync fails from the deployed app and works from a DNMS
instance running on an office machine.

---

## Runbook: make pull sync work from anywhere (Tailscale)

Give the VPS a route into the office LAN. No code changes; the existing Sync
button starts working.

### 1. Confirm the office LAN subnet

On the always-on office machine:

```bash
ip -4 addr        # Linux
ipconfig          # Windows
```

Confirm it holds an address on the same /24 as the terminal
(`192.168.29.234` → expect `192.168.29.0/24`). Use the real subnet below if it
differs.

### 2. Advertise the subnet from the office machine

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --advertise-routes=192.168.29.0/24
```

On Windows, install the Tailscale client, then from an elevated prompt:

```powershell
tailscale up --advertise-routes=192.168.29.0/24
```

### 3. Approve the route

In the Tailscale admin console → **Machines** → that machine → **Edit route
settings** → enable `192.168.29.0/24`.

**This step is the single most common reason it "doesn't work".** An advertised
route does nothing until it is approved.

### 4. Accept the route on the VPS

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --accept-routes
```

`--accept-routes` is required on Linux — subnet routes are ignored without it.

### 5. Verify from the VPS

```bash
tailscale status
ping -c 3 192.168.29.234
curl -sS -m 10 -o /dev/null -w '%{http_code}\n' http://192.168.29.234/ISAPI/System/deviceInfo
```

A `401` from that last command is **success** — the device is reachable and
asking for Digest auth, which is exactly what `hikvisionRequest` expects.

Then click **Test** on the Devices page. It should report the model/firmware
rather than a timeout.

---

## Reading the error messages

`describeFetchFailure()` in `features/attendance/server/hikvision.ts`
distinguishes the failure modes, because they have completely different causes:

| Message                          | Meaning                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `No response … nothing answered` | Packets went nowhere. Wrong network, unapproved route, or device off. |
| `refused the connection`         | Host is up, nothing listening on that port. Wrong port.               |
| `No route to …`                  | The OS has no route at all.                                           |

When the server is on a mesh VPN (a `100.64.0.0/10` address is present), the
timeout hint changes — it stops claiming "different network, no route", because
a subnet route reaches a LAN the host holds no address on. It points at the
route approval and the device instead.

---

## Notes

- **Never port-forward the terminal.** CVE-2021-36260 is an unauthenticated
  RCE on Hikvision ISAPI and these devices are scanned continuously. Every
  approach here keeps it unreachable from the internet.
- `lastSyncAt` is stamped by **both** the pull sync and the push hook.
  `lastPushAt` is stamped **only** by the hook — that is the field that tells
  you whether realtime is genuinely working.
- The "Enabled" badge on the Devices page is the stored `isActive` flag. It is
  not live connectivity; **Test** is what answers that.
