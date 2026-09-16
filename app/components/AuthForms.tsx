"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  signInAction,
  registerAction,
  ownerLoginAction,
  type FormState,
} from "@/app/actions/auth";
import { SubmitButton } from "./SubmitButton";

function ErrorNote({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p
      className="fade-in rounded-[var(--radius-sm)] px-3 py-2.5 text-[14px]"
      style={{ background: "rgba(255,59,48,0.1)", color: "var(--danger)" }}
      role="alert"
    >
      {state.error}
    </p>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        className="input"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        required
      />
      <input
        className="input"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        required
      />
      <ErrorNote state={state} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="footnote mt-2 text-center">
        No account?{" "}
        <Link href="/join" style={{ color: "var(--accent)" }}>
          Create one
        </Link>
      </p>
    </form>
  );
}

export function JoinForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(registerAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <input
        className="input"
        name="name"
        autoComplete="name"
        placeholder="Your name"
        required
        minLength={2}
      />
      <input
        className="input"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        required
      />
      <input
        className="input"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="Password — at least 8 characters"
        required
        minLength={8}
      />
      <ErrorNote state={state} />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="footnote mt-2 text-center">
        Already a member?{" "}
        <Link href="/signin" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function OwnerLoginForm() {
  const [state, action] = useActionState<FormState, FormData>(ownerLoginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        className="input"
        name="username"
        autoComplete="username"
        placeholder="Username"
        required
        autoFocus
      />
      <input
        className="input"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        required
      />
      <ErrorNote state={state} />
      <SubmitButton pendingLabel="Unlocking…">Unlock studio</SubmitButton>
    </form>
  );
}
