import { describe, expect, it } from "vitest";

import { calculateProgressPercent } from "@/lib/progress";

describe("calculateProgressPercent", () => {
  it("returns 0 when there are no blocks", () => {
    expect(calculateProgressPercent(0, 0)).toBe(0);
  });

  it("calculates bounded percentages", () => {
    expect(calculateProgressPercent(0, 10)).toBe(10);
    expect(calculateProgressPercent(4, 10)).toBe(50);
    expect(calculateProgressPercent(99, 10)).toBe(100);
  });
});
