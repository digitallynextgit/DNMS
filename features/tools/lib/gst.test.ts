import { describe, expect, it } from "vitest"
import {
  calculateGst,
  formatIndianNumber,
  formatRate,
  formatRupees,
  gstSummary,
  numberToIndianWords,
  parseQuantity,
  parseRate,
  parseRupees,
  rupeesInWords,
  type GstMode,
  type GstSupply,
} from "./gst"

describe("parseRupees", () => {
  it("reads amounts the way people type them", () => {
    expect(parseRupees("1000")).toBe(100000)
    expect(parseRupees("1,23,456.78")).toBe(12345678)
    expect(parseRupees("₹ 25,000")).toBe(2500000)
    expect(parseRupees("Rs. 500.5")).toBe(50050)
    expect(parseRupees(".5")).toBe(50)
    expect(parseRupees("0")).toBe(0)
  })

  it("rounds past two decimals to the nearest paisa, half up", () => {
    expect(parseRupees("10.005")).toBe(1001)
    expect(parseRupees("10.0049")).toBe(1000)
    expect(parseRupees("0.995")).toBe(100)
  })

  it("rejects what isn't an amount", () => {
    for (const bad of ["", "abc", "-5", "1.2.3", "12a", "99999999999999"])
      expect(parseRupees(bad)).toBeNull()
  })
})

describe("parseQuantity / parseRate", () => {
  it("treats an empty quantity as 1 and refuses zero", () => {
    expect(parseQuantity("")).toBe(1)
    expect(parseQuantity("2.5")).toBe(2.5)
    expect(parseQuantity("0")).toBeNull()
    expect(parseQuantity("x")).toBeNull()
  })

  it("takes a custom rate between 0 and 100", () => {
    expect(parseRate("12")).toBe(12)
    expect(parseRate("2.5%")).toBe(2.5)
    expect(parseRate("101")).toBeNull()
    expect(parseRate("")).toBeNull()
  })
})

describe("calculateGst", () => {
  it("adds 18% within a state as two equal halves", () => {
    const r = calculateGst({ amountPaise: 100000, ratePercent: 18, mode: "add", supply: "intra" })
    expect(r).toMatchObject({ base: 100000, cgst: 9000, sgst: 9000, igst: 0, tax: 18000 })
    expect(r?.total).toBe(118000)
  })

  it("adds IGST for another state", () => {
    const r = calculateGst({ amountPaise: 100000, ratePercent: 18, mode: "add", supply: "inter" })
    expect(r).toMatchObject({ base: 100000, cgst: 0, sgst: 0, igst: 18000, total: 118000 })
  })

  it("multiplies by the quantity first", () => {
    const r = calculateGst({
      amountPaise: 50000,
      quantity: 3,
      ratePercent: 5,
      mode: "add",
      supply: "inter",
    })
    expect(r).toMatchObject({ base: 150000, igst: 7500, total: 157500 })
  })

  it("rounds each tax to the paisa, half up", () => {
    // ₹99.99 at 18%: each half is 8.9991 -> ₹9.00; IGST 17.9982 -> ₹18.00.
    const intra = calculateGst({ amountPaise: 9999, ratePercent: 18, mode: "add", supply: "intra" })
    expect(intra).toMatchObject({ cgst: 900, sgst: 900, total: 11799 })
    // ₹0.25 at 5%: 1.25 paise -> 1 paisa (rounded half up from 1.25 is 1).
    const tiny = calculateGst({ amountPaise: 25, ratePercent: 5, mode: "add", supply: "inter" })
    expect(tiny?.igst).toBe(1)
    // ₹0.10 at 5%: exactly half a paisa -> rounds up to 1.
    const half = calculateGst({ amountPaise: 10, ratePercent: 5, mode: "add", supply: "inter" })
    expect(half?.igst).toBe(1)
  })

  it("takes GST out of a total and keeps the total exact", () => {
    const r = calculateGst({
      amountPaise: 118000,
      ratePercent: 18,
      mode: "remove",
      supply: "intra",
    })
    expect(r).toMatchObject({ base: 100000, cgst: 9000, sgst: 9000, total: 118000 })
    const odd = calculateGst({
      amountPaise: 99999,
      ratePercent: 18,
      mode: "remove",
      supply: "intra",
    })
    expect(odd?.total).toBe(99999)
    expect((odd?.base ?? 0) + (odd?.cgst ?? 0) + (odd?.sgst ?? 0)).toBe(99999)
    expect(odd?.cgst).toBe(odd?.sgst)
  })

  it("round-trips: add then remove gives the starting price back", () => {
    const rates = [0, 0.25, 3, 5, 12.5, 18, 28, 40]
    const supplies: GstSupply[] = ["intra", "inter"]
    for (const ratePercent of rates)
      for (const supply of supplies)
        for (const amountPaise of [1, 7, 99, 101, 999, 12345, 99999, 1234567, 987654321]) {
          const added = calculateGst({ amountPaise, ratePercent, mode: "add", supply })
          if (!added) throw new Error("expected a result")
          const removed = calculateGst({
            amountPaise: added.total,
            ratePercent,
            mode: "remove",
            supply,
          })
          expect(removed?.base).toBe(amountPaise)
          expect(removed?.tax).toBe(added.tax)
        }
  })

  it("says no above the limit", () => {
    const mode: GstMode = "add"
    expect(
      calculateGst({
        amountPaise: 1e14,
        quantity: 100,
        ratePercent: 18,
        mode,
        supply: "intra",
      }),
    ).toBeNull()
  })
})

describe("formatting", () => {
  it("groups digits the Indian way", () => {
    expect(formatIndianNumber(0)).toBe("0.00")
    expect(formatIndianNumber(99999)).toBe("999.99")
    expect(formatIndianNumber(100000)).toBe("1,000.00")
    expect(formatIndianNumber(12345678950)).toBe("12,34,56,789.50")
    expect(formatRupees(1e7)).toBe("₹1,00,000.00")
  })

  it("shows rates without trailing zeros", () => {
    expect(formatRate(18)).toBe("18%")
    expect(formatRate(0.25)).toBe("0.25%")
    expect(formatRate(18 / 2)).toBe("9%")
    expect(formatRate(5 / 2)).toBe("2.5%")
  })
})

describe("amount in words", () => {
  it("handles the everyday cases", () => {
    expect(rupeesInWords(0)).toBe("Rupees Zero Only")
    expect(rupeesInWords(100)).toBe("Rupees One Only")
    expect(rupeesInWords(1500)).toBe("Rupees Fifteen Only")
    expect(rupeesInWords(10500)).toBe("Rupees One Hundred Five Only")
    expect(rupeesInWords(1e7)).toBe("Rupees One Lakh Only")
  })

  it("uses lakh and crore, with paise", () => {
    expect(rupeesInWords(12345678950)).toBe(
      "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Fifty Paise Only",
    )
    expect(rupeesInWords(50)).toBe("Fifty Paise Only")
    expect(rupeesInWords(118001)).toBe("Rupees One Thousand One Hundred Eighty and One Paise Only")
  })

  it("words big crore counts", () => {
    expect(numberToIndianWords(10_00_00_00_000)).toBe("One Thousand Crore")
    expect(numberToIndianWords(20_00_015)).toBe("Twenty Lakh Fifteen")
  })
})

describe("gstSummary", () => {
  it("is a readable, copy-ready breakdown", () => {
    const r = calculateGst({
      amountPaise: 50000,
      quantity: 2,
      ratePercent: 18,
      mode: "add",
      supply: "intra",
    })
    if (!r) throw new Error("expected a result")
    expect(gstSummary(r)).toBe(
      [
        "GST at 18% - added to the price, within state",
        "Quantity: 2 x ₹500.00 (before GST)",
        "Price before GST: ₹1,000.00",
        "CGST @ 9%: ₹90.00",
        "SGST @ 9%: ₹90.00",
        "Total GST: ₹180.00",
        "Total: ₹1,180.00",
        "In words: Rupees One Thousand One Hundred Eighty Only",
      ].join("\n"),
    )
  })
})
