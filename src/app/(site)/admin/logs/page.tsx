import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listAudit, type AuditPage } from "@/lib/audit";
import { AuditLogView } from "@/components/admin/audit-log-view";
import { BackLink } from "@/components/back-link";

export const instant = false;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fadmin%2Flogs");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const raw = await searchParams;
  const query = {
    level: first(raw.level),
    category: first(raw.category),
    q: first(raw.q).trim().slice(0, 100),
    page: Math.floor(Number(first(raw.page))) || 1,
  };

  let data: AuditPage | null = null;
  let failure: string | null = null;

  try {
    data = await listAudit(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failure = /AuditLog|does not exist|relation/i.test(message)
      ? "The audit log table does not exist in this database yet. Apply the latest migration (npx prisma migrate deploy) and reload."
      : "The audit log could not be loaded right now. Check the database connection and try again.";
    console.error("Could not load the audit log:", message);
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <BackLink href="/admin" label="Back to admin console" />
        <h1 className="mb-1 text-2xl font-semibold">Audit log</h1>
        <p className="mb-8 text-sm text-muted">
          Sign-ins, account and project changes, and server errors, newest first.
        </p>

        {data ? (
          <AuditLogView
            data={data}
            query={{
              level: query.level || undefined,
              category: query.category || undefined,
              q: query.q || undefined,
            }}
          />
        ) : (
          <p role="alert" className="surface rounded-2xl p-8 text-sm text-red-600">
            {failure}
          </p>
        )}
      </main>
    </div>
  );
}
