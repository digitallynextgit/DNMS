/* Applies the saved palette before first paint (no flash). Marketing pages are dark-only, so
   they're skipped. The path list MIRRORS lib/marketing-routes.ts - this static file can't import. */
(function () {
  try {
    var MARKETING_EXACT = ["/"]
    var MARKETING_PREFIXES = ["/about", "/contact", "/pricing", "/faq", "/legal"]

    var path = window.location.pathname
    var onMarketing = MARKETING_EXACT.indexOf(path) !== -1
    if (!onMarketing) {
      for (var m = 0; m < MARKETING_PREFIXES.length; m++) {
        var pre = MARKETING_PREFIXES[m]
        if (path === pre || path.indexOf(pre + "/") === 0) {
          onMarketing = true
          break
        }
      }
    }

    var root = document.documentElement
    // Mirrors the default theme (DEFAULT_THEME_ID in lib/themes.ts); lib/themes.test.ts checks it.
    var DEFAULT_THEME = {"mode":"dark","modules":true,"cssVars":{"background":"216 28% 7%","foreground":"210 30% 92%","card":"215 25% 11%","card-foreground":"210 30% 92%","popover":"215 25% 11%","popover-foreground":"210 30% 92%","primary":"217 91% 60%","primary-foreground":"0 0% 100%","secondary":"215 22% 15%","secondary-foreground":"210 30% 92%","muted":"215 22% 15%","muted-foreground":"215 15% 62%","accent":"215 22% 18%","accent-foreground":"210 30% 92%","destructive":"0 75% 60%","destructive-foreground":"0 0% 100%","success":"142 60% 45%","success-foreground":"0 0% 100%","warning":"38 90% 55%","warning-foreground":"0 0% 10%","border":"215 20% 21%","input":"215 20% 24%","ring":"217 91% 60%"}}

    if (onMarketing) {
      // Pin dark but leave the saved palette in storage for the dashboard.
      root.classList.remove("light")
      root.classList.add("dark")
      root.style.colorScheme = "dark"

      // proxy.ts keeps the "dnms-auth" cookie in step (lib/auth-hint.ts, mirrored here), so
      // globals.css can show Dashboard instead of Log in on first paint.
      var hint = document.cookie.match(/(?:^|;\s*)dnms-auth=(employee|client)(?:;|$)/)
      if (hint) root.setAttribute("data-auth", hint[1])
      else root.removeAttribute("data-auth")
      return
    }

    var raw = localStorage.getItem("dnms-theme-palette")
    var parsed = raw ? JSON.parse(raw) : null
    var state = parsed && parsed.state
    // Never chosen, or "no palette" saved before Module Colours became the default (store v3).
    if (!state || (!state.paletteId && (parsed.version || 0) < 3)) state = DEFAULT_THEME
    if (state.modules) root.setAttribute("data-modules", "true")
    else root.removeAttribute("data-modules")
    if (!state.cssVars) return
    if (state.mode === "dark" || state.mode === "light") {
      root.classList.remove(state.mode === "dark" ? "light" : "dark")
      root.classList.add(state.mode)
      root.style.colorScheme = state.mode
      try {
        localStorage.setItem("theme", state.mode)
      } catch (e) {}
    }
    var vars = state.cssVars
    for (var k in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, k)) {
        root.style.setProperty("--" + k, vars[k])
      }
    }
  } catch (e) {}
})()
