import { z } from "zod";

export const updateUserRoleSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const assignProjectAdminSchema = z.object({
  userId: z.string().min(1, "userId is required."),
});

export type AssignProjectAdminInput = z.infer<typeof assignProjectAdminSchema>;
