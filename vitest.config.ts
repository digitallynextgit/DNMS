import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests cover pure modules only (features/*/lib) - nothing touches Prisma or Next.
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
