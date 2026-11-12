import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLabel, listLabels, MAX_LABELS } from "@/lib/projectSchema";
import { createLabelSchema } from "@/lib/validation/project";
import { canAccessProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";

type RouteContext = { params: Promise<{ slug: string }> };

async function resolveAccess(slug: string, userId: string, role: Parameters<typeof canAccessProject>[1]) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { members: true },
  });

  if (!project) {
    return { project: null, allowed: false };
  }

  const isMember = project.members.some((m) => m.userId === userId);
  const allowed = await canAccessProject(userId, role, project.id, isMember);

  return { project, allowed };
}

async function handleGET(_request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const { project, allowed } = await resolveAccess(
    slug,
    session.user.id,
    session.user.role
  );

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  return NextResponse.json(await listLabels(project.schemaName));
}

async function handlePOST(request: Request, { params }: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit({
    scope: "label-create",
    subject: session.user.id,
    limit: 30,
    windowMs: MINUTE,
    message: "You are creating labels too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
  }

  const { slug } = await params;
  const { project, allowed } = await resolveAccess(
    slug,
    session.user.id,
    session.user.role
  );

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!allowed) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createLabelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid label" },
      { status: 400 }
    );
  }

  const result = await createLabel(project.schemaName, parsed.data);

  if ("error" in result) {
    return NextResponse.json(
      {
        error:
          result.error === "limit"
            ? `A project can have at most ${MAX_LABELS} labels.`
            : "A label with that name already exists.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(result.label, { status: 201 });
}

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
