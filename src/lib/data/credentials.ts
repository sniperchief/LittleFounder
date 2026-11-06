import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Founder Passport credential reads. RLS limits rows to the signed-in parent's family; callers
// pass the child id from server-side state (Child Mode or a checked parent route). Salts are in
// credential_secrets, which no client role can read.

export type AnchorStatus = "pending" | "submitted" | "confirmed" | "failed" | "cancelled" | "revoked";

export type Credential = {
  key: string;
  title: string;
  description: string;
  anchorable: boolean;
  requirement: { type: "modules_completed"; count: number } | { type: "practice_score"; min: number };
  earned: {
    id: string;
    issuedAt: string;
    code: string;
    status: "active" | "revoked";
    hash: string;
    evidence: Record<string, unknown>;
    anchor: {
      status: AnchorStatus;
      txHash: string | null;
      attestationUid: string | null;
      schemaUid: string | null;
      issuer: string | null;
      proof: string | null;
      error: string | null;
      attempts: number;
      confirmedAt: string | null;
      updatedAt: string;
    } | null;
  } | null;
};

export async function listCredentials(supabase: SupabaseClient, childId: string): Promise<Credential[]> {
  const [types, certs] = await Promise.all([
    supabase.from("certificate_types").select("id, key, title, description, requirement, onchain_eligible").order("key"),
    supabase
      .from("certificates")
      .select(
        "id, certificate_type_id, issued_at, verification_code, status, credential_hash, evidence, " +
          "credential_issuances(status, tx_hash, attestation_uid, schema_uid, issuer_address, subject_commitment, error, attempts, confirmed_at, updated_at)",
      )
      .eq("child_id", childId),
  ]);
  if (types.error || certs.error) throw new Error("Could not load credentials.");
  type CertRow = {
    id: string;
    certificate_type_id: string;
    issued_at: string;
    verification_code: string;
    status: "active" | "revoked";
    credential_hash: string;
    evidence: Record<string, unknown>;
    credential_issuances: Record<string, unknown> | Record<string, unknown>[] | null;
  };
  const rows = (certs.data ?? []) as unknown as CertRow[];
  const order = ["founder-academy-milestone", "pitch-ready"];
  return (types.data ?? [])
    .map((t) => {
      const c = rows.find((r) => r.certificate_type_id === t.id);
      const iRaw = c ? (Array.isArray(c.credential_issuances) ? c.credential_issuances[0] : c.credential_issuances) : null;
      const i = iRaw as {
        status: AnchorStatus; tx_hash: string | null; attestation_uid: string | null; schema_uid: string | null; issuer_address: string | null;
        subject_commitment: string | null; error: string | null; attempts: number; confirmed_at: string | null; updated_at: string;
      } | null;
      return {
        key: t.key as string,
        title: t.title as string,
        description: t.description as string,
        anchorable: Boolean(t.onchain_eligible),
        requirement: t.requirement as Credential["requirement"],
        earned: c
          ? {
              id: c.id,
              issuedAt: c.issued_at,
              code: c.verification_code,
              status: c.status,
              hash: c.credential_hash,
              evidence: c.evidence,
              anchor: i
                ? {
                    status: i.status,
                    txHash: i.tx_hash,
                    attestationUid: i.attestation_uid,
                    schemaUid: i.schema_uid,
                    issuer: i.issuer_address,
                    proof: i.subject_commitment,
                    error: i.error,
                    attempts: i.attempts,
                    confirmedAt: i.confirmed_at,
                    updatedAt: i.updated_at,
                  }
                : null,
            }
          : null,
      };
    })
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export type AnchoringConsent = {
  enabled: boolean;
  grantedAt: string | null;
  history: { grantedAt: string; withdrawnAt: string | null; noticeVersion: string }[];
};

/** The parent's own anchoring choices for one child (consent_records RLS: guardian only). */
export async function getAnchoringConsent(supabase: SupabaseClient, childId: string): Promise<AnchoringConsent> {
  const [profile, records] = await Promise.all([
    supabase.from("child_profiles").select("credentials_opt_in").eq("id", childId).maybeSingle(),
    supabase
      .from("consent_records")
      .select("granted_at, withdrawn_at, notice_version")
      .eq("child_id", childId)
      .eq("consent_type", "onchain_credential")
      .order("granted_at", { ascending: false }),
  ]);
  if (profile.error || records.error) throw new Error("Could not load the anchoring setting.");
  const history = (records.data ?? []).map((r) => ({ grantedAt: r.granted_at, withdrawnAt: r.withdrawn_at, noticeVersion: r.notice_version }));
  const active = history.find((h) => !h.withdrawnAt);
  return { enabled: Boolean(profile.data?.credentials_opt_in && active), grantedAt: active?.grantedAt ?? null, history };
}

/** Child-friendly label for a credential's public-proof status (no blockchain words). */
export function proofLabel(anchor: NonNullable<Credential["earned"]>["anchor"]) {
  if (!anchor || anchor.status === "cancelled") return null;
  if (anchor.status === "confirmed") return "Extra proof added";
  if (anchor.status === "failed") return null;
  return "Extra proof on the way";
}
