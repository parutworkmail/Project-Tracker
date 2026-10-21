import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

export const instant = false;

export default async function ChangePasswordPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black">
        <h1 className="mb-2 text-2xl font-semibold">Set a new password</h1>
        {session.user.mustChangePassword && (
          <p className="mb-6 text-sm text-zinc-500">
            Your account was created with a temporary password. Please set a
            new one before continuing.
          </p>
        )}
        <ChangePasswordForm />
      </div>
    </div>
  );
}
