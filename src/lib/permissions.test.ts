import { beforeEach, describe, expect, it, vi } from "vitest";

const { projectAdminFindUnique } = vi.hoisted(() => ({
  projectAdminFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectAdmin: { findUnique: projectAdminFindUnique },
  },
}));

import {
  isSuperAdmin,
  canCreateProject,
  isAssignedProjectAdmin,
  canManageProject,
  canAccessProject,
} from "./permissions";

describe("isSuperAdmin", () => {
  it("returns true only for SUPER_ADMIN", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(isSuperAdmin("USER")).toBe(false);
  });
});

describe("canCreateProject", () => {
  it("returns true only for SUPER_ADMIN", () => {
    expect(canCreateProject("SUPER_ADMIN")).toBe(true);
    expect(canCreateProject("ADMIN")).toBe(false);
    expect(canCreateProject("USER")).toBe(false);
  });
});

describe("isAssignedProjectAdmin", () => {
  beforeEach(() => {
    projectAdminFindUnique.mockReset();
  });

  it("returns true when an assignment row exists", async () => {
    projectAdminFindUnique.mockResolvedValue({ id: "pa1" });

    const result = await isAssignedProjectAdmin("user-1", "project-1");

    expect(result).toBe(true);
    expect(projectAdminFindUnique).toHaveBeenCalledWith({
      where: {
        projectId_userId: { projectId: "project-1", userId: "user-1" },
      },
    });
  });

  it("returns false when no assignment row exists", async () => {
    projectAdminFindUnique.mockResolvedValue(null);

    const result = await isAssignedProjectAdmin("user-1", "project-1");

    expect(result).toBe(false);
  });
});

describe("canManageProject", () => {
  beforeEach(() => {
    projectAdminFindUnique.mockReset();
  });

  it("returns true for a super admin without checking assignments", async () => {
    const result = await canManageProject("user-1", "SUPER_ADMIN", "project-1");

    expect(result).toBe(true);
    expect(projectAdminFindUnique).not.toHaveBeenCalled();
  });

  it("returns false for a plain USER without checking assignments", async () => {
    const result = await canManageProject("user-1", "USER", "project-1");

    expect(result).toBe(false);
    expect(projectAdminFindUnique).not.toHaveBeenCalled();
  });

  it("returns true for an ADMIN who is assigned to the project", async () => {
    projectAdminFindUnique.mockResolvedValue({ id: "pa1" });

    const result = await canManageProject("user-1", "ADMIN", "project-1");

    expect(result).toBe(true);
  });

  it("returns false for an ADMIN who is not assigned to the project", async () => {
    projectAdminFindUnique.mockResolvedValue(null);

    const result = await canManageProject("user-1", "ADMIN", "project-1");

    expect(result).toBe(false);
  });
});

describe("canAccessProject", () => {
  beforeEach(() => {
    projectAdminFindUnique.mockReset();
  });

  it("returns true when the user is a member, regardless of role", async () => {
    const result = await canAccessProject("user-1", "USER", "project-1", true);

    expect(result).toBe(true);
    expect(projectAdminFindUnique).not.toHaveBeenCalled();
  });

  it("falls back to canManageProject when not a member", async () => {
    const result = await canAccessProject(
      "user-1",
      "SUPER_ADMIN",
      "project-1",
      false
    );

    expect(result).toBe(true);
  });

  it("returns false when not a member and not a manager", async () => {
    const result = await canAccessProject("user-1", "USER", "project-1", false);

    expect(result).toBe(false);
  });
});
