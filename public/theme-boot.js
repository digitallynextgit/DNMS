/* Runs before paint (render-blocking <script src> in <head>) to apply the saved
   theme palette and prevent a flash of the wrong colours. Kept as a static file
   so it's a plain external script - React 19 only warns about INLINE scripts.

   MARKETING PAGES ARE SKIPPED. They are dark-only and ignore the dashboard's
   custom palettes; without this check, someone signed in with, say, the Aurora
   palette would see it flash across the public homepage before React mounted
   and stripped it.

   The path list MIRRORS lib/marketing-routes.ts. This file cannot import - it
   is plain static JS served straight to the browser - so the two are kept in
   step by scripts/verify-tenant-urls.ts, which fails if they drift. */
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
      // Pin dark and leave the saved palette untouched in storage - the user
      // still has it the moment they go back to the dashboard.
      root.classList.remove("light")
      root.classList.add("dark")
      root.style.colorScheme = "dark"
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
