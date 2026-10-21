import { describe, expect, it } from "vitest";

import {
  loginSchema,
  changePasswordSchema,
  changePasswordFormSchema,
} from "./auth";

describe("loginSchema", () => {
  it("accepts a valid username/password pair", () => {
    const result = loginSchema.safeParse({
      username: "jane",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty username", () => {
    const result = loginSchema.safeParse({
      username: "",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing username", () => {
    const result = loginSchema.safeParse({
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      username: "jane",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a password of exactly 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "a".repeat(8),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 72 characters", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "a".repeat(73),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password exactly at the 72 char boundary", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "a".repeat(72),
    });
    expect(result.success).toBe(true);
  });
});

describe("changePasswordFormSchema", () => {
  it("accepts matching newPassword and confirmPassword", () => {
    const result = changePasswordFormSchema.safeParse({
      newPassword: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched newPassword and confirmPassword", () => {
    const result = changePasswordFormSchema.safeParse({
      newPassword: "password123",
      confirmPassword: "different123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });
});
