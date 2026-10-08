import { randomBytes, createCipheriv, createDecipheriv } from "crypto"

// AES-256-GCM for secrets at rest, stored as `iv:authTag:ciphertext` (each base64).
// ENCRYPTION_KEY is 32 bytes as base64 (or hex), e.g. crypto.randomBytes(32).toString("base64").

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12 // GCM standard nonce size

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY env var is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    )
  }

  let key: Buffer
  try {
    key = Buffer.from(raw, "base64")
    if (key.length !== 32) {
      key = Buffer.from(raw, "hex")
    }
  } catch {
    key = Buffer.from(raw, "hex")
  }

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use a base64 or hex string for a 256-bit key.`,
    )
  }
  return key
}

export function encrypt(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encrypt() requires a non-empty string")
  }
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":")
}

/** Throws if the input is malformed or the auth tag fails (tampered data). */
export function decrypt(payload: string): string {
  if (typeof payload !== "string") {
    throw new Error("decrypt() requires a string")
  }
  const parts = payload.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format (expected iv:authTag:ciphertext)")
  }
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")

  const key = getKey()
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString("utf8")
}

/** Null for empty input or a failed decrypt. */
export function tryDecrypt(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    return decrypt(payload)
  } catch {
    return null
  }
}
