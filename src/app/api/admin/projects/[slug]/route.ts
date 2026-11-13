import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dropProjectSchema } from "@/lib/projectSchema";
import { isSuperAdmin } from "@/lib/permissions";
import { withApiErrorHandling } from "@/lib/apiError";
import { actor, recordAudit } from "@/lib/audit";
import { enforceRateLimit, MINUTE } from "@/lib/enforceRateLimit";

// Deletes a whole project (its row, members, admin assignments and the private
// schema holding every task, comment and label). The caller must type the
// project's exact name, and it is checked here, not only in the browser.
async function handleDELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "project-delete",
    subject: session.user.id,
    limit: 10,
    windowMs: MINUTE,
    message: "You are deleting projects too quickly. Please wait a moment.",
  });

  if (limited) {
    return limited;
  }

  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const confirmName =
    typeof body === "object" && body !== null && "confirmName" in body
      ? (body as { confirmName: unknown }).confirmName
      : undefined;

  if (typeof confirmName !== "string" || confirmName.trim() === "") {
    return NextResponse.json(
      { error: "Type the project name to confirm." },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (confirmName.trim() !== project.name) {
    return NextResponse.json(
      { error: "The name you typed does not match this project." },
      { status: 400 }
    );
  }

  // Row first: members and admin assignments cascade, and if dropping the
  // schema fails afterwards the only leftover is an unreachable schema, never a
  // project that still exists but has lost its data.
  await prisma.project.delete({ where: { id: project.id } });

  let schemaDropped = true;

  try {
    await dropProjectSchema(project.schemaName);
  } catch (error) {
    schemaDropped = false;
    console.error(
      `Project ${project.slug} was deleted but its schema ${project.schemaName} could not be dropped:`,
      error
    );
  }

  await recordAudit({
    ...actor(session.user),
    level: schemaDropped ? "WARN" : "ERROR",
    category: "project",
    action: schemaDropped ? "project.deleted" : "project.schema_drop_failed",
    message: schemaDropped
      ? `Deleted project "${project.name}" from the admin console`
      : `Deleted project "${project.name}" but its data schema ${project.schemaName} could not be dropped and must be cleaned up by hand`,
    target: `project:${project.slug}`,
  });

  return NextResponse.json({ ok: true });
}

export const DELETE = withApiErrorHandling(handleDELETE);
