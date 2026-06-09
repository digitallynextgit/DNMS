import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    // Deterministic dev-only fallback - never use in production
    return Buffer.from(
      "devdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdevdev".slice(0, 64),
      "hex",
    )
  }
  return Buffer.from(hex, "hex")
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

export function decrypt(stored: string): string {
  try {
    const [ivHex, tagHex, encHex] = stored.split(":")
    if (!ivHex || !tagHex || !encHex) return ""
    const key = getKey()
    const iv = Buffer.from(ivHex, "hex")
    const tag = Buffer.from(tagHex, "hex")
    const enc = Buffer.from(encHex, "hex")
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(enc).toString("utf8") + decipher.final("utf8")
  } catch {
    return ""
  }
}
