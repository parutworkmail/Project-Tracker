import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildUniqueSlug } from "@/lib/slug";
import { generateSchemaName, provisionProjectSchema } from "@/lib/projectSchema";
import { createProjectSchema } from "@/lib/validation/project";
import { checkRateLimit } from "@/lib/rateLimit";
import { canCreateProject } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";

const CREATE_PROJECT_LIMIT = 10;
const CREATE_PROJECT_WINDOW_MS = 60 * 60 * 1000;

async function handleGET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      slug: m.project.slug,
    }))
  );
}

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

  await provisionProjectSchema(schemaName);

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      schemaName,
      createdById: session.user.id,
      members: {
        create: {
          userId: session.user.id,
        },
      },
    },
  });

  return NextResponse.json(
    { id: project.id, name: project.name, slug: project.slug },
    { status: 201 }
  );
}

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
