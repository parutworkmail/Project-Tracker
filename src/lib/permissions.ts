import { prisma } from "@/lib/prisma";
import type { GlobalRole } from "@/generated/prisma/enums";

export function isSuperAdmin(role: GlobalRole): boolean {
  return role === "SUPER_ADMIN";
}

export function canCreateProject(role: GlobalRole): boolean {
  return role === "SUPER_ADMIN";
}

export async function isAssignedProjectAdmin(
  userId: string,
  projectId: string
): Promise<boolean> {
  const assignment = await prisma.projectAdmin.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  return assignment !== null;
}

export async function canManageProject(
  userId: string,
  role: GlobalRole,
  projectId: string
): Promise<boolean> {
  if (isSuperAdmin(role)) {
    return true;
  }

  if (role !== "ADMIN") {
    return false;
  }

  return isAssignedProjectAdmin(userId, projectId);
}

export async function canAccessProject(
  userId: string,
  role: GlobalRole,
  projectId: string,
  isMember: boolean
): Promise<boolean> {
  if (isMember) {
    return true;
  }

  return canManageProject(userId, role, projectId);
}
