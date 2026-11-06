import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ConsentForm } from "@/components/onboarding/onboarding-forms";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Alert } from "@/components/ui/alert";
import { requireAdult } from "@/lib/auth/session";
import { CONSENT_NOTICE_VERSION } from "@/lib/validation";

export const metadata: Metadata = { title: "How we look after your child's data" };

const stored = [
  ["About you", "Your email address, the name you gave us, and a scrambled (hashed) version of your parent PIN."],
  ["About each child", "A nickname, a chosen avatar and an age range (10–11 or 12–13). No real names, birthdays, photos, schools or contact details."],
  ["What your child does", "Learning progress, quiz results, ideas, practice businesses and pitches they create here."],
  ["Records", "When you agreed to this notice, and key account events (like adding or removing a profile)."],
];

const promises = [
  "Your child's work is visible only to you. There's no chat, no public profiles and no ads.",
  "We don't use outside AI services, and we never sell your family's data or use it for advertising.",
  "You can remove a child's profile at any time. It's permanently deleted after 30 days.",
];

export default function ConsentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const ctx = await requireAdult();
  if (!ctx.displayName) redirect("/onboarding");
  if (ctx.hasConsent) redirect(ctx.hasPin ? "/parent" : "/onboarding/pin");

  return (
    <OnboardingShell
      step={2}
      title="How we look after your child's data"
      description="Please read this before adding a child. You need to agree before any child profile can be created."
    >
      <div className="space-y-6">
        <section aria-labelledby="stored-heading">
          <h2 id="stored-heading" className="text-lg font-bold text-ink">
            What we store
          </h2>
          <dl className="mt-3 divide-y divide-border rounded-lg border-2 border-border">
            {stored.map(([term, detail]) => (
              <div key={term} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-semibold text-ink">{term}</dt>
                <dd className="text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="promises-heading">
          <h2 id="promises-heading" className="text-lg font-bold text-ink">
            Our promises
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            {promises.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            More detail: <Link href="/privacy" className="font-semibold text-ink underline underline-offset-4">our privacy approach</Link>.
            Notice version {CONSENT_NOTICE_VERSION}.
          </p>
        </section>

        <Alert tone="warning" title="This is a preview">
          Our independent privacy and legal review isn&apos;t finished yet, so this agreement step is a
          placeholder for the final process — it is not yet a verified parental-consent check. Please use fictional
          details for any child profile until accounts officially open.
        </Alert>

        <ConsentForm />
      </div>
    </OnboardingShell>
  );
}
