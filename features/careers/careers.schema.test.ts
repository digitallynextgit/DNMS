import { describe, expect, it } from "vitest"
import { updateGroupSchema, updateSubDepartmentSchema } from "./careers.schema"

// zod 4's .partial() keeps .default(): renaming a red group or sub-department used to repaint it teal.
describe("careers update schemas", () => {
  it("leave the tone alone when an edit doesn't send it", () => {
    expect(updateGroupSchema.parse({ title: "Tech" })).not.toHaveProperty("tone")
    expect(updateSubDepartmentSchema.parse({ title: "Design" })).not.toHaveProperty("tone")
  })

  it("still accept a tone change", () => {
    expect(updateGroupSchema.parse({ tone: "red" }).tone).toBe("red")
  })
})
