import next from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

// eslint-config-next v16 exports flat configs: spread them directly (FlatCompat crashes ESLint 10).
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
    // Pinned, not "detect": eslint-plugin-react's version detection crashes on ESLint 10.
    settings: { react: { version: "19.2" } },
    rules: {
      // A leading underscore marks a deliberately unused binding, e.g. `(_req, _ctx, session)`.
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
