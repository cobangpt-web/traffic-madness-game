import { describe, expect, it } from "vitest";
import { hashSeed, localDateKey, SeededRandom } from "./random";

describe("SeededRandom", () => {
  it("reproduces the same sequence for the same seed", () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it("rejects invalid integer ranges", () => {
    expect(() => new SeededRandom(1).integer(0)).toThrow(RangeError);
  });
});

describe("daily seed helpers", () => {
  it("uses the local calendar date", () => {
    expect(localDateKey(new Date(2026, 7, 12, 23, 59))).toBe("2026-08-12");
  });

  it("hashes identical keys deterministically", () => {
    expect(hashSeed("2026-08-12")).toBe(hashSeed("2026-08-12"));
    expect(hashSeed("2026-08-12")).not.toBe(hashSeed("2026-08-13"));
  });
});

