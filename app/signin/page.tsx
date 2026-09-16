import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/session";
import { AuthShell } from "@/app/components/AuthShell";
import { SignInForm } from "@/app/components/AuthForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  if (await getMemberSession()) redirect("/");

  const { next } = await searchParams;
  const destination = typeof next === "string" ? next : "/";

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to like, save and comment.">
      <SignInForm next={destination} />
    </AuthShell>
  );
}
