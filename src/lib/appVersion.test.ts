import { describe, expect, it } from "vitest";

import { formatVersion, RELEASE_STAGE } from "./appVersion";

describe("formatVersion", () => {
  it("prefixes the version with v and appends the commit when there is one", () => {
    expect(formatVersion("0.0.1")).toBe("v0.0.1");
    expect(formatVersion("0.0.1", "ab12cd3")).toBe("v0.0.1 · ab12cd3");
  });

  it("falls back to dev when the version is unknown", () => {
    expect(formatVersion(undefined)).toBe("dev");
    expect(formatVersion(undefined, "ab12cd3")).toBe("dev · ab12cd3");
  });

  it("is labelled alpha for this release", () => {
    expect(RELEASE_STAGE).toBe("alpha");
  });
});
