import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be at most 72 characters."),
});

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const changePasswordFormSchema = changePasswordSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm the password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormInput = z.input<typeof changePasswordFormSchema>;
