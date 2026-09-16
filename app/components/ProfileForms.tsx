"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  changePasswordAction,
  deleteAccountAction,
  type ProfileState,
} from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

/** Inline result banner shared by all three forms. */
function Note({ state }: { state: ProfileState }) {
  if (!state?.error && !state?.success) return null;

  const danger = Boolean(state.error);
  return (
    <p
      className="fade-in rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px]"
      style={
        danger
          ? { background: "rgba(255,59,48,0.1)", color: "var(--danger)" }
          : { background: "rgba(52,199,89,0.12)", color: "var(--label)" }
      }
      role={danger ? "alert" : "status"}
    >
      {state.error ?? state.success}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="footnote">{label}</span>
      {children}
    </label>
  );
}

export function ProfileDetailsForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [state, action] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Display name">
        <input
          className="input"
          name="name"
          defaultValue={name}
          autoComplete="name"
          required
          minLength={2}
        />
      </Field>

      <Field label="Email">
        <input
          className="input"
          name="email"
          type="email"
          defaultValue={email}
          autoComplete="email"
          required
        />
      </Field>

      <Note state={state} />
      <SubmitButton pendingLabel="Saving…" className="btn btn-primary btn-pill self-start">
        Save changes
      </SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ProfileState, FormData>(
    changePasswordAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Current password">
        <input
          className="input"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <Field label="New password">
        <input
          className="input"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
        />
      </Field>

      <Field label="Confirm new password">
        <input
          className="input"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Note state={state} />
      <SubmitButton pendingLabel="Updating…" className="btn btn-secondary btn-pill self-start">
        Change password
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<ProfileState, FormData>(
    deleteAccountAction,
    undefined
  );

  return (
    <details className="group-none">
      <summary className="btn btn-danger btn-pill cursor-pointer list-none px-0">
        Delete my account
      </summary>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <p className="secondary text-[14px] leading-relaxed">
          This removes your account, your saved posts and your ability to sign in.
          Posts on the blog are unaffected. It cannot be undone.
        </p>

        <Field label="Confirm with your password">
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Note state={state} />
        <SubmitButton
          pendingLabel="Deleting…"
          className="btn btn-danger btn-pill self-start"
        >
          Permanently delete
        </SubmitButton>
      </form>
    </details>
  );
}
