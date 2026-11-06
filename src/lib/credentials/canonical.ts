// Credential canonicalization and hashing (format "LF-CANON-1"). See docs/CREDENTIALS.md §2.
//
// Mirrors public.canonical_json() / public.credential_hash_of() in
// supabase/migrations/20261106001100_credentials.sql; scripts/check-db.mjs checks they agree.
// Keep this file free of app imports (Node loads it directly in the checks and scripts).

import { createHash } from "node:crypto";

export const CANONICALIZATION = "LF-CANON-1";
export const CREDENTIAL_FORMAT_VERSION = 1;
/** Version of the plain-language anchoring notice parents agree to (also checked in SQL). */
export const ANCHORING_NOTICE_VERSION = "credentials-2026-11-v1";

export type CanonicalValue = string | number | boolean | null | CanonicalValue[] | { [key: string]: CanonicalValue };

/**
 * Canonical JSON: object keys sorted by code point, no whitespace, strings escaped exactly as
 * JSON.stringify does, integers only (no floats, so number formatting can't differ).
 */
export function canonicalJson(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("canonicalJson: only integers are allowed");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

/** SHA-256 of the canonical UTF-8 bytes, lowercase hex (the credential hash). */
export function credentialHash(document: CanonicalValue): string {
  return createHash("sha256").update(canonicalJson(document), "utf8").digest("hex");
}

/** Public proof: SHA-256(hash bytes || 32-byte salt) as 0x-hex. Computed server-side only. */
export function credentialProof(hashHex: string, salt: Uint8Array): `0x${string}` {
  return `0x${createHash("sha256").update(Buffer.concat([Buffer.from(hashHex, "hex"), Buffer.from(salt)])).digest("hex")}`;
}
