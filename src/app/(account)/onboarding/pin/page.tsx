import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PinSetupForm } from "@/components/onboarding/onboarding-forms";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Alert } from "@/components/ui/alert";
import { requireAdult } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose your parent PIN" };

export default function PinPage({ searchParams }: PageProps<"/onboarding/pin">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/onboarding/pin">["searchParams"] }) {
  const ctx = await requireAdult();
  if (!ctx.displayName) redirect("/onboarding");
  if (!ctx.hasConsent) redirect("/onboarding/consent");
  if (ctx.hasPin) redirect("/parent");
  const { reset } = await searchParams;

  return (
    <OnboardingShell
      step={3}
      title="Choose your parent PIN"
      description="Children use LITTLE FOUNDERS in Child Mode on your device. Your PIN is needed to leave Child Mode and get back to parent controls."
    >
      <div className="space-y-5">
        {reset === "1" ? (
          <Alert tone="success" title="Signed in again">
            Your old PIN has been cleared. Choose a new one to continue.
          </Alert>
        ) : null}
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Pick something your child won&apos;t guess — not a birthday or 1234.</li>
          <li>After 5 wrong tries, the PIN locks for 15 minutes.</li>
          <li>Forgot it? You can always reset it by signing in with your password.</li>
        </ul>
        <PinSetupForm />
      </div>
    </OnboardingShell>
  );
}
