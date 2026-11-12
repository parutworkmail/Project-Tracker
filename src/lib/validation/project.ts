import { z } from "zod";

import { isReservedSlug } from "@/lib/slug";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required.").max(80),
  memberIds: z.array(z.string()).optional(),
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
      .refine((slug) => !isReservedSlug(slug), {
        message: "This shareable link is reserved and cannot be used.",
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "At least one of name or shareable link is required.",
  });

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  username: z.string().min(1, "Username is required."),
});

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

const ISSUE_STATUSES = ["todo", "in_progress", "done"] as const;
const ISSUE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const LABEL_COLOR_VALUES = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
] as const;

export const createLabelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Label name is required.")
    .max(30, "Label name is too long (30 characters max)."),
  color: z.enum(LABEL_COLOR_VALUES).default("gray"),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;

const labelIdsField = z.array(z.string().min(1).max(64)).max(20, "Too many labels.");

const dueDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "That is not a valid date.");

export const createIssueSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().max(2000).nullable().optional().or(z.literal("")),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  dueDate: dueDateField.nullable().optional().or(z.literal("")),
  assigneeId: z.string().nullable().optional(),
  labelIds: labelIdsField.optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;

export const updateIssueSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(ISSUE_STATUSES).optional(),
    priority: z.enum(ISSUE_PRIORITIES).optional(),
    dueDate: dueDateField.nullable().optional().or(z.literal("")),
    assigneeId: z.string().nullable().optional(),
    labelIds: labelIdsField.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field is required.",
  });

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty.")
    .max(2000, "Comment is too long."),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

