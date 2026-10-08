import "server-only"

// The stored ipAddress is only a hint - these terminals use DHCP, so another host may now answer
// there. Serial + MAC are the identity: each connection checks it and re-finds the device if moved.

import os from "os"
import { db } from "@/server/db"
import {
  getDeviceIdentity,
  discoverOnLan,
  type HikvisionDeviceConfig,
  type DeviceIdentity,
} from "./hikvision"

export interface ResolvedDevice {
  config: HikvisionDeviceConfig
  identity: DeviceIdentity | null
  /** True when the device had moved and we found it somewhere else. */
  relocated: boolean
  /** Human-readable reason when it could not be reached at all. */
  error?: string
}

interface DeviceRow {
  id: string
  ipAddress: string
  port: number
  username: string
  password: string
  hardwareSerial: string | null
  macAddress: string | null
}

/** The /24 this server sits on, e.g. "192.168.29". */
function localSubnetPrefixes(): string[] {
  const prefixes = new Set<string>()
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family !== "IPv4" || a.internal) continue
      const parts = a.address.split(".")
      if (parts.length === 4) prefixes.add(parts.slice(0, 3).join("."))
    }
  }
  return [...prefixes]
}

function matches(identity: DeviceIdentity, row: DeviceRow): boolean {
  // Nothing recorded yet: accept the first connection and adopt its identity.
  if (!row.hardwareSerial && !row.macAddress) return true
  if (row.hardwareSerial && identity.serialNumber === row.hardwareSerial) return true
  if (row.macAddress && identity.macAddress.toLowerCase() === row.macAddress.toLowerCase()) {
    return true
  }
  return false
}

/** A config that points at the device: the stored address first, a subnet sweep only if that
 *  fails or answers as another device. */
export async function resolveDevice(row: DeviceRow): Promise<ResolvedDevice> {
  const base = {
    port: row.port,
    username: row.username,
    password: row.password,
  }
  const stored: HikvisionDeviceConfig = { ...base, ipAddress: row.ipAddress }

  const identity = await getDeviceIdentity(stored)
  if (identity && matches(identity, row)) {
    // Learn the identity on the first good connection.
    if (!row.hardwareSerial || !row.macAddress) {
      await db.hikvisionDevice
        .update({
          where: { id: row.id },
          data: { hardwareSerial: identity.serialNumber, macAddress: identity.macAddress },
        })
        .catch(() => {})
    }
    return { config: stored, identity, relocated: false }
  }

  // Either nothing answered, or something answered that is not our device.
  for (const prefix of localSubnetPrefixes()) {
    const found = await discoverOnLan(
      prefix,
      {
        serialNumber: row.hardwareSerial,
        macAddress: row.macAddress,
        username: row.username,
        password: row.password,
        port: row.port,
      },
      // The stored address was just tried; no point paying for it twice.
      { skip: [row.ipAddress] },
    )
    if (!found) continue

    await db.hikvisionDevice
      .update({
        where: { id: row.id },
        data: {
          ipAddress: found.ipAddress,
          hardwareSerial: found.identity.serialNumber,
          macAddress: found.identity.macAddress,
        },
      })
      .catch(() => {})

    return {
      config: { ...base, ipAddress: found.ipAddress },
      identity: found.identity,
      relocated: true,
    }
  }

  const wrongBox = identity
    ? ` Something else is answering at ${row.ipAddress} (${identity.model || "unknown model"}).`
    : ""
  return {
    config: stored,
    identity: null,
    relocated: false,
    error:
      `Could not find the device on this network.${wrongBox} ` +
      `Check it is powered on and connected, and that this server is on the same LAN.`,
  }
}
