import { vi } from "vitest";

// Route and auth tests mock "@/lib/prisma" with only the tables they care about.
// Writing audit rows is a side effect none of them should depend on, so it is a
// no-op everywhere; src/lib/audit.test.ts loads the real module with importActual.
vi.mock("@/lib/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audit")>();

  return { ...actual, recordAudit: vi.fn(async () => {}) };
});
