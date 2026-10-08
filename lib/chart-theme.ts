// Recharts tooltip styles. Recharts writes inline styles (a white box, unreadable on dark), so these
// are style objects built from theme tokens.

export const CHART_TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
} as const

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: "hsl(var(--muted-foreground))",
  fontSize: "11px",
  marginBottom: "4px",
} as const

/** Omit when the series colours act as the legend - this flattens them into one colour. */
export const CHART_TOOLTIP_ITEM_STYLE = {
  color: "hsl(var(--foreground))",
} as const

/** Neutral series for monochrome charts. Alpha steps of --foreground, so it works in both themes. */
export const CHART_NEUTRAL_SERIES = [
  "hsl(var(--foreground))",
  "hsl(var(--foreground) / 0.78)",
  "hsl(var(--foreground) / 0.62)",
  "hsl(var(--foreground) / 0.5)",
  "hsl(var(--foreground) / 0.4)",
  "hsl(var(--foreground) / 0.32)",
  "hsl(var(--foreground) / 0.24)",
] as const
