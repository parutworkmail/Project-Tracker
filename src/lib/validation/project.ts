import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required.").max(80),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z.string().min(1, "Project name is required.").max(80).optional(),
    slug: z
      .string()
      .min(3, "Shareable link must be at least 3 characters.")
      .max(64, "Shareable link is too long.")
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Only lowercase letters, numbers, and hyphens are allowed."
      )
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "At least one of name or shareable link is required.",
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
