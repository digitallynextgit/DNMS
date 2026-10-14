import { describe, expect, it } from "vitest"
import { clientCreateSchema, clientUpdateSchema } from "./client.schema"

describe("clientUpdateSchema", () => {
  // zod 4's .partial() keeps .default(): changing just the account manager used to reactivate
  // an INACTIVE client.
  it("leaves the status alone when an edit doesn't send it", () => {
    expect(clientUpdateSchema.parse({ ownerId: "emp-1" })).not.toHaveProperty("status")
  })

  it("keeps ACTIVE as the default for a new client", () => {
    expect(clientCreateSchema.parse({ name: "Acme" }).status).toBe("ACTIVE")
  })
})
