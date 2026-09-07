import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests cover the PURE modules only (features/*/lib): derivation maths,
// lifecycle tables, date rules. Nothing here touches Prisma or Next.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".next-*/**"],
    environment: "node",
  },
})
