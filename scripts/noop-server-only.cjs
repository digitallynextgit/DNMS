// Stand-in for the `server-only` package when a CLI script imports a module that
// guards itself with it. That guard exists to stop server code being pulled into
// a CLIENT bundle; a tsx script is server-side by definition, so the guard has
// nothing to protect and would only stop the script importing the real logic.
// See scripts/backfill-hold-followups.ts.
module.exports = {}
