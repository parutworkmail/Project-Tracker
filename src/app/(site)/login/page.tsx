"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";

import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { PasswordInput } from "@/components/password-input";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(
    searchParams.get("message")
  );

  const rawCallbackUrl = searchParams.get("callbackUrl");
  // Only allow same-origin relative paths (e.g. "/projecta/board") — never
  // an absolute/external URL, which would be an open-redirect vulnerability
  // if someone crafted a malicious ?callbackUrl= link.
  const callbackUrl =
    rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setFormError(null);

    const result = await signIn("credentials", {
      ...data,
      redirect: false,
    });

    if (result?.error) {
      if (result.code === "account-locked") {
        setFormError(
          "Too many failed attempts. This account is temporarily locked — try again in 15 minutes."
        );
      } else if (result.code === "rate-limited") {
        setFormError("Too many login attempts. Please try again later.");
      } else if (result.code === "db-unavailable") {
        setFormError(
          "Cannot reach the database right now. Please try again shortly, or contact an admin if this persists."
        );
      } else if (result.code === "unexpected-error") {
        setFormError(
          "An unexpected error occurred while logging in. Please try again."
        );
      } else {
        setFormError("Invalid username or password.");
      }
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="animate-float pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-yellow-300/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="animate-float-slow pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-blue-500/12 blur-3xl"
      />
      <div className="surface animate-pop relative w-full max-w-sm rounded-3xl p-8 shadow-xl shadow-slate-900/10">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-200 to-yellow-400 text-on-accent shadow-lg shadow-yellow-500/25">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l4 4L19 6" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back. Sign in to continue.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="Username"
              {...register("username")}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-surface"
            />
            {errors.username && (
              <p role="alert" className="text-sm text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder="Password"
              {...register("password")}
              className="rounded border border-black/[.08] py-2 pl-3 dark:border-white/[.145] dark:bg-surface"
            />
            {errors.password && (
              <p role="alert" className="text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" aria-live="polite" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
          >
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
