import { describe, expect, it } from "vitest";
import { SeededRng } from "../shared/src/rng";

describe("SeededRng", () => {
  it("deterministik untuk seed yang sama", () => {
    const a = new SeededRng(42), b = new SeededRng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("berbeda untuk seed berbeda", () => {
    expect(new SeededRng(1).next()).not.toEqual(new SeededRng(2).next());
  });
  it("int() selalu dalam rentang", () => {
    const r = new SeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
    }
  });
});
