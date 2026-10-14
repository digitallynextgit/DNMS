import { describe, expect, it } from "vitest"
import { createEmployeeSchema, updateEmployeeSchema } from "./employee.schema"

describe("updateEmployeeSchema", () => {
  // zod 4's .partial() keeps .default(): an edit of just the phone used to come out FULL_TIME,
  // flipping interns and contractors and recomputing their leave.
  it("leaves the employment type alone when an edit doesn't send it", () => {
    expect(updateEmployeeSchema.parse({ phone: "9999999999" })).not.toHaveProperty(
      "employmentType",
    )
  })

  it("still accepts an employment type change", () => {
    expect(updateEmployeeSchema.parse({ employmentType: "INTERN" }).employmentType).toBe("INTERN")
  })

  it("keeps FULL_TIME as the default for a new hire", () => {
    expect(createEmployeeSchema.shape.employmentType.parse(undefined)).toBe("FULL_TIME")
  })
})
