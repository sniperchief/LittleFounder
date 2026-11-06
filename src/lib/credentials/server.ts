import "server-only";

import { createClient } from "@supabase/supabase-js";

import { chainConfigFromEnv, runAnchorJobs, sendingBlocker, verifyAnchor, type AnchorCheck } from "@/lib/credentials/eas";

// Server-side credential anchoring. The service-role key and the issuer key are read from
// server-only environment variables (no NEXT_PUBLIC_ prefix), so they never reach a browser
// bundle. The service-role client is used ONLY for the two anchoring worker functions.

export const chainConfig = () => chainConfigFromEnv(process.env);

export const anchoringBlocker = () => sendingBlocker(chainConfig());

function workerRpc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args);
}

/** Best-effort run of the anchoring queue. Never throws: offchain credentials don't depend on it. */
export async function processAnchoringQueue(maxJobs = 5) {
  const cfg = chainConfig();
  const blocker = sendingBlocker(cfg);
  const rpc = workerRpc();
  if (blocker || !rpc) return { ran: false, reason: blocker ?? "Server credentials for the anchoring worker are missing." };
  try {
    return { ran: true, summary: await runAnchorJobs(rpc, cfg, maxJobs) };
  } catch (e) {
    console.error("Credential anchoring run failed:", e instanceof Error ? e.message : e);
    return { ran: false, reason: "The anchoring run failed; it will be retried." };
  }
}

/** Read-only on-chain check for the public verification page. Never throws. */
export async function checkAnchorOnChain(expected: Parameters<typeof verifyAnchor>[1]): Promise<AnchorCheck> {
  try {
    return await verifyAnchor(chainConfig(), expected);
  } catch {
    return { ok: false, reason: "Base Sepolia could not be reached just now. Try again later." };
  }
}
