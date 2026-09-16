import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/session";
import { AuthShell } from "@/app/components/AuthShell";
import { JoinForm } from "@/app/components/AuthForms";

export const metadata: Metadata = { title: "Create account" };

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  if (await getMemberSession()) redirect("/");

  const { next } = await searchParams;
  const destination = typeof next === "string" ? next : "/";

  return (
    <AuthShell
      title="Become a member"
      subtitle="Free, and only takes a moment. Reading stays open either way."
    >
      <JoinForm next={destination} />
    </AuthShell>
  );
}
