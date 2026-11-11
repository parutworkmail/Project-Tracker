import Link from "next/link";

import { BackLink } from "@/components/back-link";

const CONTACT_NAME = "John Doe";

export default function JoinPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="surface animate-fade-up w-full max-w-md rounded-2xl p-8">
        <BackLink href="/" label="Back to home" />
        <h1 className="text-2xl font-semibold tracking-tight">Join us</h1>
        <p className="mt-3 text-muted">
          Accounts are created by an administrator, so there is no sign-up form.
        </p>
        <p className="mt-4">
          Please contact your project admin, or contact{" "}
          <strong>{CONTACT_NAME}</strong>, to have your account added.
        </p>
        <p className="mt-6 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
