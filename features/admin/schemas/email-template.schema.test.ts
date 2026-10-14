import { describe, expect, it } from "vitest"
import { emailTemplateUpdateSchema } from "./email-template.schema"

describe("emailTemplateUpdateSchema", () => {
  // zod 4's .partial() keeps .default(): editing a subject used to clear the merge fields and
  // switch a disabled template back on.
  it("leaves merge fields and the on/off switch alone when an edit doesn't send them", () => {
    const parsed = emailTemplateUpdateSchema.parse({ subject: "Hello" })
    expect(parsed).not.toHaveProperty("mergeFields")
    expect(parsed).not.toHaveProperty("isActive")
  })
})
