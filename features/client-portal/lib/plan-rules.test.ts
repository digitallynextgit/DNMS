import { describe, expect, it } from "vitest"

import { mayWithdraw, type WithdrawableLike } from "./plan-rules"

const ME = "client-1"
const OTHER_CLIENT = "client-2"
const STAFF = "employee-1"

/** A request this client made, not yet started - the one withdrawable shape. */
const mine: WithdrawableLike = {
  loggedById: null,
  loggedByClientId: ME,
  status: "PLANNED",
}

describe("mayWithdraw", () => {
  it("allows a client to take back their own untouched request", () => {
    expect(mayWithdraw(mine, ME)).toBe(true)
  })

  it("refuses a row the team planned", () => {
    // What the team committed to is the team's to drop, not the client's.
    expect(mayWithdraw({ ...mine, loggedByClientId: null }, ME)).toBe(false)
  })

  it("refuses another client's request on the same project", () => {
    expect(mayWithdraw({ ...mine, loggedByClientId: OTHER_CLIENT }, ME)).toBe(false)
  })

  it("refuses a staff-written row even when a client id is also present", () => {
    // Belt and braces: loggedById is the authority on who wrote it.
    expect(mayWithdraw({ ...mine, loggedById: STAFF }, ME)).toBe(false)
  })

  it("refuses the moment anybody has started or made it", () => {
    // From here the row is a record of real work, and deleting it would erase
    // that - the whole reason the rule stops at PLANNED.
    for (const status of ["IN_PROGRESS", "DELIVERED", "ACCEPTED", "REJECTED"]) {
      expect(mayWithdraw({ ...mine, status }, ME), status).toBe(false)
    }
  })

  it("refuses when the caller has no id to match", () => {
    expect(mayWithdraw(mine, "")).toBe(false)
  })

  it("refuses a row with no author at all", () => {
    // Imported history, or a row whose author was deleted. Nobody's to withdraw.
    expect(mayWithdraw({ loggedById: null, loggedByClientId: null, status: "PLANNED" }, ME)).toBe(
      false,
    )
  })
})
