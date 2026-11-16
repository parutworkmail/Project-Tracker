"use client";

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  changePasswordFormSchema,
  type ChangePasswordFormInput,
} from "@/lib/validation/auth";
import { PasswordInput } from "@/components/password-input";

export function ChangePasswordForm({
  redirectTo = "/dashboard",
}: {
  redirectTo?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
  });

  async function onSubmit(data: ChangePasswordFormInput) {
    setFormError(null);

    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: data.newPassword }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(
        typeof body?.error === "string" ? body.error : "Something went wrong."
      );
      return;
    }

    // Full page load on purpose: the client router cache still holds the
    // redirect-to-/change-password answer it got for /dashboard right after
    // login, and a soft navigation would replay it and leave the user here.
    setRedirecting(true);
    window.location.assign(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="change-password-new" className="text-sm font-medium">
          New password
        </label>
        <PasswordInput
          id="change-password-new"
          autoComplete="new-password"
          placeholder="New password"
          {...register("newPassword")}
          className="rounded border border-black/[.08] py-2 pl-3 dark:border-white/[.145] dark:bg-surface"
        />
        {errors.newPassword && (
          <p role="alert" className="text-sm text-red-600">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="change-password-confirm"
          className="text-sm font-medium"
        >
          Confirm new password
        </label>
        <PasswordInput
          id="change-password-confirm"
          autoComplete="new-password"
          placeholder="Confirm new password"
          {...register("confirmPassword")}
          className="rounded border border-black/[.08] py-2 pl-3 dark:border-white/[.145] dark:bg-surface"
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

      <ActionButton
        type="submit"
        pending={isSubmitting || redirecting}
        pendingLabel="Saving..."
        className="rounded bg-foreground px-4 py-2 text-background"
      >
        Set new password
      </ActionButton>
    </form>
  );
}
