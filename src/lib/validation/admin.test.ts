import { describe, expect, it } from "vitest";

import { createUserSchema, createUserFormSchema } from "./admin";

describe("createUserSchema", () => {
  it("accepts a minimal valid payload (no name/email, default role)", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("USER");
      expect(result.data.name).toBeUndefined();
      expect(result.data.email).toBeUndefined();
    }
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = createUserSchema.safeParse({
      username: "jd",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a username with invalid characters", () => {
    const result = createUserSchema.safeParse({
      username: "john doe!",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a username with dots, dashes and underscores", () => {
    const result = createUserSchema.safeParse({
      username: "john.doe-1_2",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes an empty email string to undefined", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });

  it("rejects an invalid email format", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      password: "short1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 72 characters", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      password: "a".repeat(73),
    });

    expect(result.success).toBe(false);
  });

  it("accepts an explicit role override", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      password: "password123",
      role: "ADMIN",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("ADMIN");
    }
  });

  it("rejects an invalid role", () => {
    const result = createUserSchema.safeParse({
      username: "jdoe",
      password: "password123",
      role: "NOT_A_ROLE",
    });

    expect(result.success).toBe(false);
  });
});

describe("createUserFormSchema", () => {
  it("accepts matching password and confirmPassword", () => {
    const result = createUserFormSchema.safeParse({
      username: "jdoe",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched password and confirmPassword", () => {
    const result = createUserFormSchema.safeParse({
      username: "jdoe",
      password: "password123",
      confirmPassword: "different123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("rejects a missing confirmPassword", () => {
    const result = createUserFormSchema.safeParse({
      username: "jdoe",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });
});
