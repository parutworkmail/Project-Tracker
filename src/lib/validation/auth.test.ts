import { describe, expect, it } from "vitest";

import { loginSchema, signupSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email/password pair", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts a valid signup payload", () => {
    const result = signupSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jane");
    }
  });

  it("normalizes an empty string name to undefined", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "jane@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
    }
  });

  it("allows name to be omitted entirely", () => {
    const result = signupSchema.safeParse({
      email: "jane@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      email: "jane@example.com",
      password: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 72 characters (bcrypt truncation guard)", () => {
    const result = signupSchema.safeParse({
      email: "jane@example.com",
      password: "a".repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password exactly at the 72 char boundary", () => {
    const result = signupSchema.safeParse({
      email: "jane@example.com",
      password: "a".repeat(72),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      email: "nope",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});
