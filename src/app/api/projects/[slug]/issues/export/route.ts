import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchIssues, MAX_PAGE_SIZE } from "@/lib/projectSchema";
import { canAccessProject } from "@/lib/permissions";
import { parseIssueFilters } from "@/lib/issueFilters";
import { toCsv } from "@/lib/csv";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  userLabel,
} from "@/lib/issueMeta";
import { withApiErrorHandling } from "@/lib/apiError";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";

const EXPORT_ROW_LIMIT = 5000;

const HEADERS = [
  "#",
  "Title",
  "Description",
  "Status",
  "Priority",
  "Due date",
  "Assignee",
  "Labels",
  "Created by",
  "Created at",
  "Updated at",
];

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "project";
}

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "issue-export",
    subject: session.user.id,
    limit: 10,
    windowMs: MINUTE,
    message: "You are exporting too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
  }

  const { slug } = await params;

  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const isMember = project.members.some((m) => m.userId === session.user.id);
  const canAccess = await canAccessProject(
    session.user.id,
    session.user.role,
    project.id,
    isMember
  );

  if (!canAccess) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const filters = parseIssueFilters(
    Object.fromEntries(new URL(request.url).searchParams)
  );

  const options = {
    q: filters.q || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    assignee: filters.assignee || undefined,
    label: filters.label || undefined,
    sort: filters.sort,
    pageSize: MAX_PAGE_SIZE,
  };

  const issues = [];
  let total = 0;

  for (let page = 1; issues.length < EXPORT_ROW_LIMIT; page++) {
    const result = await searchIssues(project.schemaName, { ...options, page });
    total = result.total;
    issues.push(...result.issues);

    if (result.issues.length === 0 || issues.length >= result.total) break;
  }

  const rows = issues.slice(0, EXPORT_ROW_LIMIT);

  const userIds = [
    ...new Set(
      rows
        .flatMap((issue) => [issue.assignee_id, issue.created_by])
        .filter((id): id is string => !!id)
    ),
  ];

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, name: true },
      })
    : [];
  const names = new Map(users.map((user) => [user.id, userLabel(user)]));

  const csv = toCsv(
    HEADERS,
    rows.map((issue) => [
      issue.number,
      issue.title,
      issue.description ?? "",
      STATUS_LABELS[issue.status] ?? issue.status,
      PRIORITY_LABELS[issue.priority] ?? issue.priority,
      issue.due_date ?? "",
      issue.assignee_id ? (names.get(issue.assignee_id) ?? "Former member") : "",
      issue.labels.map((label) => label.name).join("; "),
      names.get(issue.created_by) ?? "Former member",
      new Date(issue.created_at).toISOString(),
      new Date(issue.updated_at).toISOString(),
    ])
  );

  const day = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFilePart(project.slug)}-tasks-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Export-Total": String(total),
      "X-Export-Truncated": String(total > rows.length),
    },
  });
}

export const GET = withApiErrorHandling(handleGET);
