import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required.").max(80),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required.").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
