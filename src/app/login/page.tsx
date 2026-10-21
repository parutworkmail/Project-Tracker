"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense, useState } from "react";

import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { GoogleSignInButton } from "@/components/google-signin-button";

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
      setFormError("Invalid email or password.");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black">
        <h1 className="mb-6 text-2xl font-semibold">Log in</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              {...register("email")}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {errors.email && (
              <p role="alert" className="text-sm text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              {...register("password")}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
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

        <GoogleSignInButton />

        <p className="mt-6 text-center text-sm text-zinc-500">
          No account?{" "}
          <a href="/signup" className="font-medium text-foreground">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
