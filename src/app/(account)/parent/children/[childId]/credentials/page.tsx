import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  checkAnchoringAction,
  retryAnchoringAction,
  withdrawAnchoringAction,
} from "@/app/(account)/parent/children/[childId]/credentials/actions";
import { AnchoringConsentForm } from "@/components/credentials/anchoring-consent-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/form-controls";
import { requireParent } from "@/lib/auth/session";
import { BASE_SEPOLIA, txUrl } from "@/lib/credentials/eas";
import { anchoringBlocker } from "@/lib/credentials/server";
import { getChild } from "@/lib/data/children";
import { getAnchoringConsent, listCredentials, type Credential } from "@/lib/data/credentials";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Credentials" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const errors: Record<string, string> = {
  confirm: "Please tick the box to confirm.",
  consent_required: "Turn on public proofs first.",
  not_retryable: "That proof isn't waiting for a retry.",
  too_many_attempts: "This proof has been tried several times. Please contact support.",
  child_mode_active: "Leave Child Mode before changing parent settings.",
};

const anchorStatus: Record<string, { label: string; tone: "neutral" | "sun" | "mint" | "coral" }> = {
  pending: { label: "Queued", tone: "sun" },
  submitted: { label: "Sent — waiting for confirmation", tone: "sun" },
  confirmed: { label: "Anchored and verified", tone: "mint" },
  failed: { label: "Failed — can be retried", tone: "coral" },
  cancelled: { label: "Not anchored (consent withdrawn)", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
};

export default function CredentialsPage(props: PageProps<"/parent/children/[childId]/credentials">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: PageProps<"/parent/children/[childId]/credentials">) {
  await requireParent();
  const [{ childId }, query] = await Promise.all([params, searchParams]);
  if (!uuidSchema.safeParse(childId).success) notFound();
  // RLS returns nothing for another family's child, so this is a 404 for them.
  const child = await getChild(childId);
  if (!child) notFound();
  const supabase = await createClient();
  const [credentials, consent] = await Promise.all([listCredentials(supabase, child.id), getAnchoringConsent(supabase, child.id)]);
  const earned = credentials.filter((c) => c.earned);
  const blocker = anchoringBlocker();
  const error = typeof query.error === "string" ? (errors[query.error] ?? "Something went wrong. Please try again.") : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={`/parent/children/${child.id}`} className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> {child.nickname}&apos;s activity
      </Link>
      <h1 className="mt-6 text-3xl font-extrabold text-ink">Credentials for {child.nickname}</h1>
      <p className="mt-1 text-muted-foreground">
        Credentials are learning milestones issued from {child.nickname}&apos;s real, checked progress. They are stored privately by Little
        Founders and can be checked with a verification link that shows no personal details.
      </p>

      {query.enabled === "1" ? <Alert tone="success" className="mt-6">Public proofs are on. Eligible credentials have been queued.</Alert> : null}
      {query.withdrawn === "1" ? (
        <Alert tone="success" className="mt-6">
          Public proofs are off. No new proofs will be recorded. Proofs already recorded stay on the public network.
        </Alert>
      ) : null}
      {query.retrying === "1" ? <Alert tone="success" className="mt-6">We&apos;ll try recording that proof again.</Alert> : null}
      {query.checked === "1" ? <Alert tone="info" className="mt-6">Progress checked.</Alert> : null}
      {error ? <Alert tone="error" className="mt-6">{error}</Alert> : null}

      <section aria-labelledby="earned" className="mt-8">
        <h2 id="earned" className="text-xl font-bold text-ink">
          Earned credentials
        </h2>
        {earned.length === 0 ? (
          <p className="mt-3 rounded-lg border-2 border-dashed border-ink/20 px-4 py-5 text-center text-muted-foreground">
            No credentials yet. {child.nickname} earns one by completing all six Academy modules, and another by scoring 70+ in an Investor
            Room practice.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {earned.map((c) => (
              <CredentialRow key={c.key} credential={c} childId={child.id} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="proofs" className="mt-10 rounded-xl border-2 border-ink bg-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border-2 border-ink bg-grape-soft">
            <ShieldCheck className="size-5 text-ink" aria-hidden="true" />
          </span>
          <h2 id="proofs" className="text-xl font-bold text-ink">
            Public proofs (optional)
          </h2>
          <Badge tone={consent.enabled ? "mint" : "neutral"}>{consent.enabled ? "On" : "Off"}</Badge>
        </div>
        <div className="mt-4 space-y-3 text-ink/90">
          <p>
            You can choose to add an <strong>anonymous proof</strong> of each credential to <strong>{BASE_SEPOLIA.name}</strong>, a public
            blockchain network. It lets anyone with the verification link confirm the credential wasn&apos;t changed, without relying on Little
            Founders alone.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              The proof is a scrambled code (a salted hash). It contains <strong>no personal information</strong>: no name, nickname, age, school,
              answers or pitch content, and no wallet for your child.
            </li>
            <li>
              Records on a public blockchain are <strong>publicly viewable and may be permanent</strong>. They can&apos;t be deleted later.
            </li>
            <li>Little Founders pays any network fees. Neither you nor your child need a wallet or cryptocurrency.</li>
            <li>This is separate from the consent you gave when you joined. It is off unless you turn it on here, for this child only.</li>
            <li>
              Turning it off stops <strong>new</strong> proofs. It can&apos;t erase a proof that&apos;s already recorded, and your child&apos;s
              credentials stay valid either way.
            </li>
          </ul>
        </div>

        {consent.enabled ? (
          <div className="mt-5 space-y-4">
            <p className="font-semibold text-ink">
              On since {consent.grantedAt ? dateTime.format(new Date(consent.grantedAt)) : "—"}.
            </p>
            <form action={withdrawAnchoringAction} className="space-y-3 rounded-lg bg-muted p-4">
              <input type="hidden" name="childId" value={child.id} />
              <label className="flex items-start gap-3 text-ink">
                <input type="checkbox" name="confirm" value="withdraw" className="mt-0.5 size-5 shrink-0 accent-ink" />
                <span>
                  Stop new public proofs for {child.nickname}. I understand proofs already recorded can&apos;t be erased.
                </span>
              </label>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Saving…">
                Turn off public proofs
              </SubmitButton>
            </form>
          </div>
        ) : (
          <div className="mt-5">
            <AnchoringConsentForm childId={child.id} nickname={child.nickname} />
          </div>
        )}

        {consent.history.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Your choices</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink/85">
              {consent.history.map((h) => (
                <li key={h.grantedAt}>
                  Turned on {dateTime.format(new Date(h.grantedAt))}
                  {h.withdrawnAt ? ` · turned off ${dateTime.format(new Date(h.withdrawnAt))}` : " · still on"} (notice {h.noticeVersion})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {blocker && consent.enabled ? (
          <Alert tone="warning" className="mt-5" title="Proofs are queued but not being recorded yet">
            This server isn&apos;t set up to record proofs right now. Credentials remain valid and verifiable without them.
          </Alert>
        ) : null}
      </section>
    </div>
  );
}

function CredentialRow({ credential: c, childId }: { credential: Credential; childId: string }) {
  const e = c.earned!;
  const a = e.anchor;
  const status = a ? anchorStatus[a.status] : null;
  return (
    <li className="rounded-xl border-2 border-ink bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-1 size-6 shrink-0 text-ink" aria-hidden="true" />
          <div>
            <p className="text-lg font-bold text-ink">{c.title}</p>
            <p className="text-sm text-ink/75">{c.description}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Issued {dateFormat.format(new Date(e.issuedAt))} · {e.status === "active" ? "Valid" : "Revoked"}
            </p>
          </div>
        </div>
        <Link
          href={`/verify/${e.code}`}
          className="inline-flex items-center gap-1 rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold text-ink hover:bg-muted"
        >
          Verification page <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-ink/75">Credential hash (SHA-256)</dt>
        <dd className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{e.hash}</dd>
        <dt className="font-semibold text-ink/75">Public proof</dt>
        <dd className="text-ink">{status ? <Badge tone={status.tone}>{status.label}</Badge> : <span className="text-muted-foreground">Not requested</span>}</dd>
        {a?.proof && a.status !== "pending" ? (
          <>
            <dt className="font-semibold text-ink/75">Proof value (on-chain)</dt>
            <dd className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{a.proof}</dd>
          </>
        ) : null}
        {a?.txHash ? (
          <>
            <dt className="font-semibold text-ink/75">Transaction</dt>
            <dd className="font-mono text-xs [overflow-wrap:anywhere]">
              <a href={txUrl(a.txHash)} target="_blank" rel="noreferrer noopener" className="text-ink underline underline-offset-4">
                {a.txHash}
              </a>
            </dd>
          </>
        ) : null}
        {a?.attestationUid ? (
          <>
            <dt className="font-semibold text-ink/75">EAS attestation UID</dt>
            <dd className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{a.attestationUid}</dd>
          </>
        ) : null}
        {a?.status === "confirmed" && a.confirmedAt ? (
          <>
            <dt className="font-semibold text-ink/75">Verified on-chain</dt>
            <dd className="text-ink">{dateTime.format(new Date(a.confirmedAt))} · {BASE_SEPOLIA.name}, chain {BASE_SEPOLIA.chainId}</dd>
          </>
        ) : null}
        {a?.error && a.status !== "confirmed" ? (
          <>
            <dt className="font-semibold text-ink/75">Last message</dt>
            <dd className="text-ink/85 [overflow-wrap:anywhere]">{a.error}</dd>
          </>
        ) : null}
      </dl>
      {a && (a.status === "pending" || a.status === "submitted") ? (
        <form action={checkAnchoringAction} className="mt-4">
          <input type="hidden" name="childId" value={childId} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Checking…">
            Check progress
          </SubmitButton>
        </form>
      ) : null}
      {a?.status === "failed" ? (
        <form action={retryAnchoringAction} className="mt-4">
          <input type="hidden" name="childId" value={childId} />
          <input type="hidden" name="certificateId" value={e.id} />
          <SubmitButton size="sm" variant="secondary" pendingLabel="Retrying…">
            Try again
          </SubmitButton>
        </form>
      ) : null}
    </li>
  );
}
