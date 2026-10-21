import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CreateUserForm } from "@/components/admin/create-user-form";

export const instant = false;

export default async function CreateUserPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-12">
        <h1 className="mb-6 text-2xl font-semibold">Create user</h1>
        <CreateUserForm />
      </main>
    </div>
  );
}
