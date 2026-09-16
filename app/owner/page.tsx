import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOwner, ownerCredentialsConfigured } from "@/lib/session";
import { AuthShell } from "@/app/components/AuthShell";
import { OwnerLoginForm } from "@/app/components/AuthForms";

export const metadata: Metadata = { title: "Owner", robots: { index: false } };

export default async function OwnerLoginPage() {
  // Already unlocked — go straight through to the studio.
  if (await getOwner()) redirect("/owner/studio");

  return (
    <AuthShell title="Studio" subtitle="Sign in to write and publish.">
      <OwnerLoginForm />
      {!ownerCredentialsConfigured() ? (
        <p className="footnote mt-4 text-center">
          Set <code>OWNER_USERNAME</code> and <code>OWNER_PASSWORD</code> in your
          environment variables to enable sign-in.
        </p>
      ) : null}
    </AuthShell>
  );
}
