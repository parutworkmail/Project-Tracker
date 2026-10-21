"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { GoogleSignInButton } from "@/components/google-signin-button";

export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  async function onSubmit(data: SignupInput) {
    setFormError(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(
        typeof body?.error === "string"
          ? body.error
          : "Something went wrong."
      );
      return;
    }

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      router.push(
        "/login?message=" +
          encodeURIComponent(
            "Account created, but auto login failed. Please log in."
          )
      );
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black">
        <h1 className="mb-6 text-2xl font-semibold">Sign up</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Name"
              {...register("name")}
              className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {errors.name && (
              <p role="alert" className="text-sm text-red-600">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="signup-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder="Password (min 8 characters)"
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
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <GoogleSignInButton />

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-foreground">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
