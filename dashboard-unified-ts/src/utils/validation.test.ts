import { describe, it, expect } from "vitest";
import { isValidPhone } from "./validation";

describe("isValidPhone", () => {
  it("accepts 10-digit US numbers (backend/OpenPhone may still reject invalid lines)", () => {
    expect(isValidPhone("(212) 121-2121")).toBe(true);
    expect(isValidPhone("2121212121")).toBe(true);
    expect(isValidPhone("9144501678")).toBe(true);
  });

  it("accepts 11 digits with leading country code 1", () => {
    expect(isValidPhone("+1 914 450 1678")).toBe(true);
    expect(isValidPhone("19144501678")).toBe(true);
  });

  it("rejects wrong lengths", () => {
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("123456789012")).toBe(false);
  });
});
