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

export interface AssignableUser {
  id: string;
  username: string;
  name: string | null;
}

export async function getAssignableUsers(
  projectId: string
): Promise<AssignableUser[]> {
  const [members, admins] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, username: true, name: true } } },
    }),
    prisma.projectAdmin.findMany({
      where: { projectId },
      select: { user: { select: { id: true, username: true, name: true } } },
    }),
  ]);

  const byId = new Map<string, AssignableUser>();
  for (const row of [...members, ...admins]) {
    byId.set(row.user.id, row.user);
  }

  return [...byId.values()].sort((a, b) =>
    a.username.localeCompare(b.username)
  );
}

export async function isAssignableUser(
  projectId: string,
  userId: string
): Promise<boolean> {
  const [membership, assignment] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }),
    prisma.projectAdmin.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }),
  ]);

  return membership !== null || assignment !== null;
}
