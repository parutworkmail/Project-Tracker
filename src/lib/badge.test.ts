import { describe, expect, it } from "vitest";

import { badgeLabel } from "@/lib/badge";

describe("badgeLabel", () => {
  it("shows nothing for zero, negatives and junk", () => {
    expect(badgeLabel(0)).toBe("");
    expect(badgeLabel(-3)).toBe("");
    expect(badgeLabel(Number.NaN)).toBe("");
    expect(badgeLabel(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("shows the number from 1 to 9", () => {
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
  });

  it("caps anything above 9 at 9+", () => {
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(250)).toBe("9+");
  });
});
