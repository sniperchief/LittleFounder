import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { DisplayNameForm } from "@/components/onboarding/onboarding-forms";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { requireAdult } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your account" };

export default function OnboardingNamePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await requireAdult();
  return (
    <OnboardingShell
      step={1}
      title="Welcome to LITTLE FOUNDERS"
      description="Three quick steps to set up your family space. First, how should we greet you?"
    >
      <DisplayNameForm defaultValue={ctx.displayName} />
    </OnboardingShell>
  );
}
