// The plain-text twin of a campaign body. Spam filters expect a text/plain part beside the HTML,
// and readers with HTML off still get the message, the links and what the pictures said.

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  zwnj: "",
  zwj: "",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
}

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const n = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

export function htmlToText(html: string): string {
  let s = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // A hidden preheader repeats the subject; it has no place in the text part.
    .replace(/<div[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, "")
  // Pictures speak through their alt text; links keep their address.
  s = s.replace(/<img\b[^>]*\balt\s*=\s*"([^"]*)"[^>]*>/gi, (_m, alt: string) =>
    alt.trim() ? `\n${alt.trim()}\n` : "",
  )
  s = s.replace(
    /<a\b[^>]*\bhref\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, inner: string) => {
      const label = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      if (!label) return ""
      return /^(https?:)?\/\//i.test(href) ? `${label} (${href})` : label
    },
  )
  s = s.replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table|\/td)\b[^>]*>/gi, "\n")
  s = s.replace(/<[^>]+>/g, "")
  return decode(s)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
