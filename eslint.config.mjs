import next from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

// eslint-config-next v16 ships NATIVE flat configs (both of these imports are
// already flat-config arrays). Running them back through FlatCompat -- which
// exists to convert legacy .eslintrc objects -- made ESLint 10 throw
// "Converting circular structure to JSON" on every invocation, so no lint ever
// actually ran. Spread them directly instead.
export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "prisma/migrations/**",
      "public/**",
    ],
  },
  ...next,
  ...nextTypescript,
  {
    // Pinned deliberately, NOT "detect". eslint-plugin-react@7.37.5's
    // auto-detection path calls context.getFilename(), removed in ESLint 10, and
    // crashes the whole run ("contextOrFilename.getFilename is not a function").
    // An explicit version string short-circuits that path in
    // getReactVersionFromContext(). Bump this when React majors change.
    settings: { react: { version: "19.2" } },
    rules: {
      // The repo already uses a leading underscore to mark a binding as
      // deliberately unused - `(_req, _ctx, session)` on every withAuth handler,
      // because the signature is fixed and you cannot drop an earlier argument.
      // The default rule does not know that convention, so it reported ~90 of
      // these as dead code and buried the genuinely unused ones.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Must stay last: switches off stylistic rules that fight Prettier.
  prettier,
]
