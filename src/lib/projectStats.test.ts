import { describe, expect, it } from "vitest";

import { completionPercent } from "@/components/project-stats-strip";

const base = { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, unassigned: 0 };

describe("completionPercent", () => {
  it("is 0 for an empty project instead of NaN", () => {
    expect(completionPercent(base)).toBe(0);
  });

  it("rounds done/total to a whole percent", () => {
    expect(completionPercent({ ...base, total: 3, done: 1 })).toBe(33);
    expect(completionPercent({ ...base, total: 3, done: 2 })).toBe(67);
    expect(completionPercent({ ...base, total: 4, done: 4 })).toBe(100);
  });
});
