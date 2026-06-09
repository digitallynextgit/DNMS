/* Runs before paint (render-blocking <script src> in <head>) to apply the saved
   theme palette and prevent a flash of the wrong colours. Kept as a static file
   so it's a plain external script - React 19 only warns about INLINE scripts. */
(function () {
  try {
    var raw = localStorage.getItem("dnms-theme-palette")
    if (!raw) return
    var parsed = JSON.parse(raw)
    var state = parsed && parsed.state
    if (!state || !state.cssVars) return
    var root = document.documentElement
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
