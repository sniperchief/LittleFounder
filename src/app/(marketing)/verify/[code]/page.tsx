import type { Metadata } from "next";
import { CircleAlert, CircleCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { BASE_SEPOLIA, txUrl, addressUrl } from "@/lib/credentials/eas";
import { checkAnchorOnChain } from "@/lib/credentials/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// Public credential check. Shows the minimum needed to trust a credential: its type, issue
// date, issuer, integrity check and (if anchored) the on-chain check. Never a name, nickname,
// profile id or any learning content. Codes are unguessable; there is no listing or search.

export const metadata: Metadata = { title: "Verify a credential", robots: { index: false, follow: false } };

type Verification = {
  status: "valid" | "revoked" | "integrity_failed" | "not_found";
  credential?: { type: string; title: string; description: string; issued_on: string; issuer: string; format_version: number };
  integrity?: { hash_matches: boolean; algorithm: string; canonicalization: string };
  anchor?: {
    status: "submitted" | "confirmed" | "revoked";
    chain_id: number;
    tx_hash: `0x${string}` | null;
    attestation_uid: `0x${string}` | null;
    schema_uid: string | null;
    issuer_address: string | null;
    proof: `0x${string}` | null;
    proof_matches: boolean;
  } | null;
};

export default function VerifyPage(props: PageProps<"/verify/[code]">) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Suspense fallback={<div role="status" aria-label="Checking" className="h-64 animate-pulse rounded-2xl border-2 border-border bg-surface" />}>
        <Result {...props} />
      </Suspense>
    </div>
  );
}

function Row({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-mint" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-coral-ink" aria-hidden="true" />}
      <span>
        <span className="sr-only">{ok ? "Passed: " : "Not passed: "}</span>
        {children}
      </span>
    </li>
  );
}

async function Result({ params }: PageProps<"/verify/[code]">) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = /^[A-Za-z0-9]{12,32}$/.test(code)
    ? await supabase.rpc("verify_credential", { code })
    : { data: { status: "not_found" } };
  const v = (data ?? { status: "not_found" }) as Verification;

  if (v.status === "not_found" || !v.credential) {
    return (
      <section className="rounded-2xl border-2 border-ink bg-surface p-6 text-center">
        <CircleAlert className="mx-auto size-10 text-coral-ink" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-extrabold text-ink">We couldn&apos;t find that credential</h1>
        <p className="mt-2 text-muted-foreground">Check the link is complete. Credentials that have been removed can no longer be verified.</p>
      </section>
    );
  }

  const a = v.anchor;
  const chain = a?.tx_hash && a.proof && a.issuer_address
    ? await checkAnchorOnChain({ txHash: a.tx_hash, proof: a.proof, typeKey: v.credential.type, issuer: a.issuer_address, attestationUid: a.attestation_uid })
    : null;
  const valid = v.status === "valid";

  return (
    <section className="rounded-2xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-12 items-center justify-center rounded-full border-2 border-ink", valid ? "bg-mint" : "bg-coral-soft")}>
          {valid ? <ShieldCheck className="size-6 text-ink" aria-hidden="true" /> : <CircleAlert className="size-6 text-ink" aria-hidden="true" />}
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Credential check</p>
          <h1 className="text-2xl font-extrabold text-ink">
            {valid ? "This credential is genuine" : v.status === "revoked" ? "This credential has been revoked" : "This credential failed its integrity check"}
          </h1>
        </div>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-ink/75">Credential</dt>
        <dd className="font-bold text-ink">{v.credential.title}</dd>
        <dt className="font-semibold text-ink/75">What it means</dt>
        <dd className="text-ink">{v.credential.description}</dd>
        <dt className="font-semibold text-ink/75">Issued</dt>
        <dd className="text-ink">{new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${v.credential.issued_on}T00:00:00Z`))}</dd>
        <dt className="font-semibold text-ink/75">Issuer</dt>
        <dd className="text-ink">{v.credential.issuer}</dd>
      </dl>

      <h2 className="mt-6 text-lg font-bold text-ink">Checks</h2>
      <ul className="mt-2 space-y-2 text-ink">
        <Row ok>Issued by Little Founders from the learner&apos;s recorded progress</Row>
        <Row ok={Boolean(v.integrity?.hash_matches)}>
          Stored record matches its fingerprint ({v.integrity?.algorithm.toUpperCase()} over {v.integrity?.canonicalization} canonical JSON)
        </Row>
        <Row ok={v.status !== "revoked"}>{v.status === "revoked" ? "Revoked by the issuer" : "Not revoked"}</Row>
        {a ? (
          <Row ok={Boolean(chain?.ok && a.proof_matches && !chain.revoked)}>
            {chain?.ok && a.proof_matches
              ? chain.revoked
                ? `Public proof found on ${BASE_SEPOLIA.name}, but it has been revoked`
                : `Public proof found and checked on ${BASE_SEPOLIA.name} just now`
              : `Public proof not confirmed on ${BASE_SEPOLIA.name}: ${!a.proof_matches ? "the proof doesn't match the stored record." : (chain?.reason ?? "")}`}
          </Row>
        ) : (
          <li className="text-sm text-muted-foreground">No public blockchain proof was requested for this credential. It is still valid.</li>
        )}
      </ul>

      {a?.tx_hash ? (
        <details className="mt-6 rounded-lg bg-muted p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">Technical details</summary>
          <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            <dt className="text-ink/75">Network</dt>
            <dd className="text-ink">{BASE_SEPOLIA.name} (chain {a.chain_id})</dd>
            <dt className="text-ink/75">Transaction</dt>
            <dd className="font-mono text-xs [overflow-wrap:anywhere]">
              <a href={txUrl(a.tx_hash)} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-ink underline underline-offset-4">
                {a.tx_hash} <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </dd>
            {a.attestation_uid ? (
              <>
                <dt className="text-ink/75">EAS attestation</dt>
                <dd className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{a.attestation_uid}</dd>
              </>
            ) : null}
            <dt className="text-ink/75">Proof value</dt>
            <dd className="font-mono text-xs text-ink [overflow-wrap:anywhere]">{a.proof}</dd>
            {a.issuer_address ? (
              <>
                <dt className="text-ink/75">Issuer address</dt>
                <dd className="font-mono text-xs [overflow-wrap:anywhere]">
                  <a href={addressUrl(a.issuer_address)} target="_blank" rel="noreferrer noopener" className="text-ink underline underline-offset-4">
                    {a.issuer_address}
                  </a>
                </dd>
              </>
            ) : null}
          </dl>
          <p className="mt-3 text-xs text-ink/70">
            The proof is a salted SHA-256 fingerprint. It contains no personal information and can&apos;t be linked to a learner without Little
            Founders&apos; private records.
          </p>
        </details>
      ) : null}

      <p className="mt-6 text-xs text-muted-foreground">
        Little Founders credentials celebrate learning milestones. They are not formal educational qualifications.
      </p>
    </section>
  );
}
