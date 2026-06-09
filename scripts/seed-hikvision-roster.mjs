/**
 * Sets the Hikvision biometric device ID (Employee.deviceId) on the CURRENT
 * employees. Does NOT create any employees.
 *
 * Run:  node scripts/seed-hikvision-roster.mjs
 *
 * deviceId is what the attendance import / device sync use to match a punch's
 * "Employee ID" to an employee. Employees not on the device (e.g. remote staff
 * DN01/DN02) are simply left without one.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const raw = await readFile(resolve(__dirname, "..", ".env"), "utf8")
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// Current employee (by employeeNo) → their Hikvision device "Employee ID".
const DEVICE_IDS = [
  { employeeNo: "132", deviceId: "132" }, // Mridul
  { employeeNo: "136", deviceId: "136" }, // Hemant
  { employeeNo: "137", deviceId: "137" }, // Ayushi
  { employeeNo: "143", deviceId: "143" }, // Teesha
  { employeeNo: "144", deviceId: "144" }, // Karan Joshi
  { employeeNo: "145", deviceId: "145" }, // Diwakar
  { employeeNo: "146", deviceId: "146" }, // Komal
  { employeeNo: "149", deviceId: "10" }, // Aashutosh (device ID differs from code)
  // DN01 Guruprasad / DN02 Gavisha: remote, not on the biometric → no deviceId.
]

async function main() {
  console.log("Setting Hikvision device IDs on current employees…")
  let updated = 0
  for (const u of DEVICE_IDS) {
    const res = await prisma.employee.updateMany({
      where: { employeeNo: u.employeeNo },
      data: { deviceId: u.deviceId },
    })
    if (res.count > 0) {
      updated++
      console.log(`  ✓ ${u.employeeNo}  deviceId=${u.deviceId}`)
    } else {
      console.log(`  ! ${u.employeeNo}  not found (skipped)`)
    }
  }
  console.log(`\nDone. ${updated} employees updated.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end().catch(() => {})
  })
