// =============================================================================
// Recharts tooltip styling
// =============================================================================
// Recharts hardcodes its tooltip as a WHITE box with pale grey text. That is
// invisible on the dark theme - a white card with near-white labels floating
// over a black chart - and it cannot be fixed with a Tailwind class, because
// Recharts writes the styles inline on the element it renders.
//
// So the styles are objects, fed to <Tooltip contentStyle/labelStyle/itemStyle>,
// and every value is a theme token: the same tooltip reads correctly in light
// and dark without a second definition or a `theme` prop threaded through.
//
// One copy for the whole app - six charts across four features had drifted into
// their own `{ fontSize: 12, borderRadius: 8 }`, which changed the corners and
// left the contrast bug untouched.
// =============================================================================

/** The tooltip box: card surface, real border, readable text. */
export const CHART_TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
} as const

/** The heading row (the x-axis value). Muted: it labels the numbers below it. */
export const CHART_TOOLTIP_LABEL_STYLE = {
  color: "hsl(var(--muted-foreground))",
  fontSize: "11px",
  marginBottom: "4px",
} as const

/**
 * Series rows. Only for charts where every row should read as plain text -
 * OMIT it when the series colours are the legend (a two-line chart where teal
 * means clicks), because this overrides them into one flat colour.
 */
export const CHART_TOOLTIP_ITEM_STYLE = {
  color: "hsl(var(--foreground))",
} as const
