import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildUniqueSlug } from "@/lib/slug";
import { generateSchemaName, provisionProjectSchema } from "@/lib/projectSchema";
import { createProjectSchema } from "@/lib/validation/project";
import { checkRateLimit } from "@/lib/rateLimit";
import { canCreateProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

const CREATE_PROJECT_LIMIT = 100;
const CREATE_PROJECT_WINDOW_MS = 60 * 1000;

async function handlePOST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canCreateProject(session.user.role)) {
    return NextResponse.json(
      { error: "Only super admins can create projects." },
      { status: 403 }
    );
  }

  const rateLimit = await checkRateLimit(
    `create-project:${session.user.id}`,
    CREATE_PROJECT_LIMIT,
    CREATE_PROJECT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many projects created. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      }
    );
  }

  const body = await request.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name } = parsed.data;
  const slug = buildUniqueSlug(name);
  const schemaName = generateSchemaName();

  // Dedupe and never double-insert the creator (added separately below);
  // also drop any id that doesn't correspond to a real user, rather than
  // letting an invalid id crash project creation with a raw FK violation.
  const requestedMemberIds = Array.from(
    new Set((parsed.data.memberIds ?? []).filter((id) => id !== session.user.id))
  );

  const validMembers =
    requestedMemberIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: requestedMemberIds } },
          select: { id: true },
        })
      : [];
  const extraMemberIds = validMembers.map((u) => u.id);

  await provisionProjectSchema(schemaName);

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      schemaName,
      createdById: session.user.id,
      members: {
        create: [
          { userId: session.user.id },
          ...extraMemberIds.map((userId) => ({ userId })),
        ],
      },
    },
  });

  return NextResponse.json(
    { id: project.id, name: project.name, slug: project.slug },
    { status: 201 }
  );
}

export const POST = withApiErrorHandling(handlePOST);
