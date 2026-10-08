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
    if (!raw) return
    var parsed = JSON.parse(raw)
    var state = parsed && parsed.state
    if (!state || !state.cssVars) return
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
