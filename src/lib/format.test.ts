import { describe, expect, it } from "vitest";

import { formatGrams, formatMinutes, formatPHP } from "./format";

describe("formatPHP", () => {
  it("formats pesos with the ₱ sign, grouping and centavos", () => {
    expect(formatPHP(1234.5)).toBe("₱1,234.50");
    expect(formatPHP(0)).toBe("₱0.00");
    expect(formatPHP(87.456)).toBe("₱87.46");
  });

  it("drops centavos when asked for whole pesos", () => {
    expect(formatPHP(149.6, { whole: true })).toBe("₱150");
  });

  it("formats negative amounts", () => {
    expect(formatPHP(-20)).toBe("-₱20.00");
  });

  it("returns a placeholder for missing or invalid amounts", () => {
    expect(formatPHP(null)).toBe("—");
    expect(formatPHP(undefined)).toBe("—");
    expect(formatPHP(Number.NaN)).toBe("—");
    expect(formatPHP(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatMinutes", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [60, "1 hr"],
    [75, "1 hr 15 min"],
    [120, "2 hr"],
    [44.6, "45 min"],
  ])("%s → %s", (input, expected) => {
    expect(formatMinutes(input)).toBe(expected);
  });

  it("returns a placeholder for negative or missing values", () => {
    expect(formatMinutes(-5)).toBe("—");
    expect(formatMinutes(null)).toBe("—");
  });
});

describe("formatGrams", () => {
  it.each([
    [2.5, "2.5 g"],
    [0.25, "0.3 g"],
    [250, "250 g"],
    [999.4, "999 g"],
    [1000, "1 kg"],
    [1250, "1.25 kg"],
    [2000, "2 kg"],
  ])("%s → %s", (input, expected) => {
    expect(formatGrams(input)).toBe(expected);
  });

  it("returns a placeholder for negative or missing values", () => {
    expect(formatGrams(-1)).toBe("—");
    expect(formatGrams(undefined)).toBe("—");
  });
});
