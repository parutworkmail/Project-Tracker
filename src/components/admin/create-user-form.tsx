"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createUserFormSchema,
  type CreateUserFormInput,
} from "@/lib/validation/admin";
import { PasswordInput } from "@/components/password-input";

const ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const;

export function CreateUserForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { role: "USER" },
  });

  async function onSubmit(data: CreateUserFormInput) {
    setFormError(null);
    setCreatedUsername(null);

    const { confirmPassword, ...payload } = data;
    void confirmPassword;

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(
        typeof body?.error === "string" ? body.error : "Something went wrong."
      );
      return;
    }

    const user = await res.json();
    reset({ role: "USER" });
    setCreatedUsername(user.username);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="new-user-username"
          type="text"
          autoComplete="off"
          placeholder="Username"
          {...register("username")}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {errors.username && (
          <p role="alert" className="text-sm text-red-600">
            {errors.username.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-name" className="text-sm font-medium">
          Name (optional)
        </label>
        <input
          id="new-user-name"
          type="text"
          placeholder="Full name"
          {...register("name")}
          className="rounded border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-email" className="text-sm font-medium">
          Email (optional)
        </label>
        <input
          id="new-user-email"
          type="email"
          autoComplete="off"
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
        <label htmlFor="new-user-role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="new-user-role"
          {...register("role")}
          className="rounded border border-black/[.08] bg-white px-3 py-2 dark:border-white/[.145] dark:bg-black"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-user-password" className="text-sm font-medium">
          Temporary password
        </label>
        <PasswordInput
          id="new-user-password"
          autoComplete="new-password"
          placeholder="Temporary password"
          {...register("password")}
          className="rounded border border-black/[.08] py-2 pl-3 dark:border-white/[.145] dark:bg-black"
        />
        {errors.password && (
          <p role="alert" className="text-sm text-red-600">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="new-user-confirm-password"
          className="text-sm font-medium"
        >
          Confirm password
        </label>
        <PasswordInput
          id="new-user-confirm-password"
          autoComplete="new-password"
          placeholder="Confirm temporary password"
          {...register("confirmPassword")}
          className="rounded border border-black/[.08] py-2 pl-3 dark:border-white/[.145] dark:bg-black"
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-sm text-red-600">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" aria-live="polite" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      {createdUsername && (
        <p role="status" className="text-sm text-green-600">
          User &ldquo;{createdUsername}&rdquo; created. They must change
          their password on first login.
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {isSubmitting ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
