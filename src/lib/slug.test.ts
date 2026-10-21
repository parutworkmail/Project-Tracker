import { describe, expect, it } from "vitest";

import { buildUniqueSlug, randomSuffix, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("strips leading/trailing non-alphanumeric chars", () => {
    expect(slugify("  --Hello World!!--  ")).toBe("hello-world");
  });

  it("collapses consecutive separators", () => {
    expect(slugify("foo___bar   baz")).toBe("foo-bar-baz");
  });

  it("truncates to 48 chars", () => {
    const longName = "a".repeat(100);
    expect(slugify(longName)).toHaveLength(48);
  });

  it("returns empty string for input with no valid chars", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("randomSuffix", () => {
  it("defaults to 6 lowercase alphanumeric chars", () => {
    const suffix = randomSuffix();
    expect(suffix).toHaveLength(6);
    expect(suffix).toMatch(/^[a-z0-9]{6}$/);
  });

  it("respects a custom length", () => {
    expect(randomSuffix(12)).toHaveLength(12);
  });
});

describe("buildUniqueSlug", () => {
  it("appends a random suffix to the slugified name", () => {
    const slug = buildUniqueSlug("My Project");
    expect(slug).toMatch(/^my-project-[a-z0-9]{6}$/);
  });

  it("falls back to 'project' when the name has no valid chars", () => {
    const slug = buildUniqueSlug("!!!");
    expect(slug).toMatch(/^project-[a-z0-9]{6}$/);
  });

  it("produces different slugs on repeated calls", () => {
    const a = buildUniqueSlug("Same Name");
    const b = buildUniqueSlug("Same Name");
    expect(a).not.toBe(b);
  });
});
