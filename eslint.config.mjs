import { FlatCompat } from "@eslint/eslintrc"
import prettier from "eslint-config-prettier"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [...compat.extends("next/core-web-vitals", "next/typescript"), prettier]
