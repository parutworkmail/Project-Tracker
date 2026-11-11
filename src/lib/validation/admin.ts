import { z } from "zod";

export const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(32, "Username must be at most 32 characters.")
    .regex(
      USERNAME_PATTERN,
      "Username may only contain letters, numbers, dots, dashes and underscores."
    ),
  name: z
    .string()
    .max(80)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  email: z
    .string()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters."),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).default("USER"),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

export const createUserFormSchema = createUserSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm the password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type CreateUserFormInput = z.input<typeof createUserFormSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

const optionalClearable = (schema: z.ZodString) =>
  schema
    .nullable()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : (value?.trim() ? value.trim() : null)
    );

export const updateUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(32, "Username must be at most 32 characters.")
      .regex(
        USERNAME_PATTERN,
        "Username may only contain letters, numbers, dots, dashes and underscores."
      )
      .optional(),
    name: optionalClearable(z.string().max(80, "Name is too long.")),
    email: z
      .union([
        z.string().trim().email("Enter a valid email address."),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((value) => (value === undefined ? undefined : value || null)),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field is required.",
  });

export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const assignProjectAdminSchema = z.object({
  userId: z.string().min(1, "userId is required."),
});

export type AssignProjectAdminInput = z.infer<typeof assignProjectAdminSchema>;
