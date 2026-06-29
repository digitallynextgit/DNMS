import "dotenv/config"
import { createHash } from "crypto"
import { Client } from "pg"
const D = { ip: "192.168.29.234", port: 80, user: "admin", pass: "Admin@2025" }
const md5 = (s) => createHash("md5").update(s).digest("hex")
const parseDigest = (h) => {
  const r = {}
  const re = /(\w+)=(?:"([^"]+)"|([^,\s]+))/g
  let m
  while ((m = re.exec(h))) r[m[1]] = m[2] ?? m[3]
  return r
}
function buildDigest(method, uri, ch) {
  const { realm = "", nonce = "", qop, opaque } = ch
  const ha1 = md5(`${D.user}:${realm}:${D.pass}`)
  const ha2 = md5(`${method}:${uri}`)
  let nc = "",
    cn = "",
    resp = ""
  if (qop === "auth") {
    nc = "00000001"
    cn = Math.random().toString(36).slice(2, 10)
    resp = md5(`${ha1}:${nonce}:${nc}:${cn}:${qop}:${ha2}`)
  } else resp = md5(`${ha1}:${nonce}:${ha2}`)
  let hd = `Digest username="${D.user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${resp}"`
  if (qop === "auth") hd += `, qop=${qop}, nc=${nc}, cnonce="${cn}"`
  if (opaque) hd += `, opaque="${opaque}"`
  return hd
}
async function req(method, path, body) {
  const url = `http://${D.ip}:${D.port}${path}`
  const headers = { "Content-Type": "application/json", Accept: "application/json" }
  const bs = body ? JSON.stringify(body) : undefined
  let p = await fetch(url, { method, headers, body: bs })
  if (p.status !== 401) return { ok: p.ok, status: p.status, text: await p.text() }
  const ch = parseDigest(p.headers.get("www-authenticate") || "")
  const a = buildDigest(method, path, ch)
  const r = await fetch(url, { method, headers: { ...headers, Authorization: a }, body: bs })
  return { ok: r.ok, status: r.status, text: await r.text() }
}
const persons = new Map() // id -> {name, count, firstTime}
let pos = 0,
  total = 0
for (let pg = 0; pg < 400; pg++) {
  const cond = {
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: pos,
      maxResults: 50,
      major: 5,
      minor: 75,
      startTime: "2025-01-01T00:00:00+00:00",
      endTime: "2026-12-31T23:59:59+00:00",
    },
  }
  const r = await req("POST", "/ISAPI/AccessControl/AcsEvent?format=json", cond)
  if (!r.ok) {
    console.log("HTTP", r.status)
    break
  }
  const j = JSON.parse(r.text)
  const e = j.AcsEvent
  if (!e || e.responseStatusStrg === "NO MATCH") break
  const list = e.InfoList || []
  total = e.totalMatches ?? total
  for (const x of list) {
    if (!x.employeeNoString) continue
    const k = x.employeeNoString
    const cur = persons.get(k) || { name: x.name || "?", count: 0, first: x.time }
    cur.count++
    if (x.time < cur.first) cur.first = x.time
    persons.set(k, cur)
  }
  const m = e.numOfMatches ?? list.length
  pos += m
  if (pos >= total || list.length === 0) break
  process.stdout.write(`fetched ${pos}/${total}\r`)
}
console.log(`\nfetched ${pos} of ${total} punch events; distinct persons=${persons.size}`)
const c = new Client({ connectionString: (process.env.DATABASE_URL || "").replace(/\?.*$/, "") })
await c.connect()
const emps = (
  await c.query("select id, employee_no, device_id, first_name, last_name from employees")
).rows
const byNo = new Map()
for (const ep of emps) {
  byNo.set(String(ep.employee_no), ep)
  if (ep.device_id) byNo.set(String(ep.device_id), ep)
}
console.log("\ndevice person -> matched employee:")
const sorted = [...persons.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))
for (const [id, info] of sorted) {
  const emp = byNo.get(String(id))
  console.log(
    `  id=${id} (${info.name}, ${info.count} punches, since ${info.first?.slice(0, 10)}) -> ${emp ? emp.first_name + " " + emp.last_name + " [" + emp.employee_no + "]" : "❌ UNMATCHED"}`,
  )
}
await c.end()
