// Base Sepolia + EAS anchoring for Founder Passport credentials. See docs/CREDENTIALS.md §4–§5.
//
// Only an anonymous proof is ever sent on-chain: bytes32 credentialType (a public constant
// per milestone), bytes32 credentialProof (SHA-256 of the credential hash + a secret salt,
// computed in the database) and uint16 formatVersion. No names, ids, dates of birth,
// answers or pitch content. Recipient is the zero address: no child or parent wallet.
//
// Server-only by design: the issuer key is passed in from server-side environment variables
// and never reaches a browser bundle. Keep this file free of app imports (scripts load it).

import {
  createPublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  http,
  keccak256,
  parseEventLogs,
  toHex,
  zeroAddress,
  zeroHash,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { easAbi, schemaRegistryAbi } from "./eas-abi.ts";

// Verified 2026-11-06 against the official EAS deployment records
// (@ethereum-attestation-service/eas-contracts deployments/base-sepolia) and on-chain
// (EAS.version() = "1.4.1-beta.3", EAS.getSchemaRegistry() = the registry below).
export const BASE_SEPOLIA = {
  chainId: 84532,
  name: "Base Sepolia (test network)",
  defaultRpcUrl: "https://sepolia.base.org",
  eas: "0x4200000000000000000000000000000000000021",
  schemaRegistry: "0x4200000000000000000000000000000000000020",
  explorer: "https://sepolia.basescan.org",
} as const;

export const SCHEMA = "bytes32 credentialType,bytes32 credentialProof,uint16 formatVersion";
export const SCHEMA_RESOLVER = zeroAddress;
export const SCHEMA_REVOCABLE = true;

/** Same formula as SchemaRegistry._getUID: keccak256(abi.encodePacked(schema, resolver, revocable)). */
export const schemaUid = (): Hex => keccak256(encodePacked(["string", "address", "bool"], [SCHEMA, SCHEMA_RESOLVER, SCHEMA_REVOCABLE]));

/** Public, non-personal identifier for a milestone type, e.g. "founder-academy-milestone". */
export const credentialTypeId = (typeKey: string): Hex => keccak256(toHex(`little-founders:credential:${typeKey}:v1`));

export const encodeAttestationData = (typeKey: string, proof: Hex) =>
  encodeAbiParameters(
    [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint16" }],
    [credentialTypeId(typeKey), proof, 1],
  );

export const txUrl = (hash: string) => `${BASE_SEPOLIA.explorer}/tx/${hash}`;
export const addressUrl = (address: string) => `${BASE_SEPOLIA.explorer}/address/${address}`;

// ---------------------------------------------------------------------------
// Configuration (from server-side environment variables only)
// ---------------------------------------------------------------------------

export type ChainConfig = { rpcUrl: string; privateKey?: Hex; sendingEnabled: boolean };

export function chainConfigFromEnv(env: Record<string, string | undefined>): ChainConfig {
  const key = env.CREDENTIAL_ISSUER_PRIVATE_KEY?.trim();
  return {
    rpcUrl: env.BASE_SEPOLIA_RPC_URL?.trim() || BASE_SEPOLIA.defaultRpcUrl,
    privateKey: key && /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : undefined,
    sendingEnabled: env.CREDENTIAL_ANCHORING_ENABLED === "true",
  };
}

/** Why anchoring can't send transactions right now, or null when it can. */
export function sendingBlocker(cfg: ChainConfig): string | null {
  if (!cfg.sendingEnabled) return "Anchoring is switched off on this server (CREDENTIAL_ANCHORING_ENABLED is not \"true\").";
  if (!cfg.privateKey) return "No issuer key is configured (CREDENTIAL_ISSUER_PRIVATE_KEY).";
  return null;
}

export const publicClientFor = (cfg: Pick<ChainConfig, "rpcUrl">): PublicClient =>
  createPublicClient({ chain: baseSepolia, transport: http(cfg.rpcUrl, { timeout: 20_000 }) }) as PublicClient;

export const issuerAddress = (cfg: ChainConfig) => (cfg.privateKey ? privateKeyToAccount(cfg.privateKey).address : null);

// ---------------------------------------------------------------------------
// Network & schema checks
// ---------------------------------------------------------------------------

export async function networkStatus(cfg: ChainConfig) {
  const client = publicClientFor(cfg);
  const [chainId, easVersion, registry, schema] = await Promise.all([
    client.getChainId(),
    client.readContract({ address: BASE_SEPOLIA.eas, abi: easAbi, functionName: "version" }),
    client.readContract({ address: BASE_SEPOLIA.eas, abi: easAbi, functionName: "getSchemaRegistry" }),
    client.readContract({ address: BASE_SEPOLIA.schemaRegistry, abi: schemaRegistryAbi, functionName: "getSchema", args: [schemaUid()] }),
  ]);
  const issuer = issuerAddress(cfg);
  return {
    chainId,
    chainOk: chainId === BASE_SEPOLIA.chainId,
    easVersion,
    registryOk: registry.toLowerCase() === BASE_SEPOLIA.schemaRegistry.toLowerCase(),
    schemaUid: schemaUid(),
    schemaRegistered: schema.uid !== zeroHash,
    schemaMatches: schema.uid === zeroHash || (schema.schema === SCHEMA && schema.revocable === SCHEMA_REVOCABLE && schema.resolver === SCHEMA_RESOLVER),
    issuer,
    issuerBalanceWei: issuer ? await client.getBalance({ address: issuer }) : null,
  };
}

/** Simulates SchemaRegistry.register (no transaction): returns the UID the contract would assign. */
export async function simulateSchemaUid(cfg: ChainConfig, from: Hex = zeroAddress) {
  const client = publicClientFor(cfg);
  const { result } = await client.simulateContract({
    address: BASE_SEPOLIA.schemaRegistry,
    abi: schemaRegistryAbi,
    functionName: "register",
    args: [SCHEMA, SCHEMA_RESOLVER, SCHEMA_REVOCABLE],
    account: from,
  });
  return result;
}

/** One-off setup: registers the schema from the issuer account. Safe to re-run. */
export async function registerSchema(cfg: ChainConfig) {
  const blocker = sendingBlocker(cfg);
  if (blocker) throw new Error(blocker);
  const client = publicClientFor(cfg);
  const account = privateKeyToAccount(cfg.privateKey!);
  const existing = await client.readContract({ address: BASE_SEPOLIA.schemaRegistry, abi: schemaRegistryAbi, functionName: "getSchema", args: [schemaUid()] });
  if (existing.uid !== zeroHash) return { uid: existing.uid, txHash: null as Hex | null, alreadyRegistered: true };
  const data = encodeFunctionData({ abi: schemaRegistryAbi, functionName: "register", args: [SCHEMA, SCHEMA_RESOLVER, SCHEMA_REVOCABLE] });
  const raw = await signCall(client, account, BASE_SEPOLIA.schemaRegistry, data);
  const txHash = await client.sendRawTransaction({ serializedTransaction: raw.serialized });
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error(`Schema registration reverted (${txHash})`);
  const after = await client.readContract({ address: BASE_SEPOLIA.schemaRegistry, abi: schemaRegistryAbi, functionName: "getSchema", args: [schemaUid()] });
  if (after.uid !== schemaUid()) throw new Error("Schema UID on-chain does not match the computed UID");
  return { uid: after.uid, txHash, alreadyRegistered: false };
}

async function signCall(client: PublicClient, account: ReturnType<typeof privateKeyToAccount>, to: Hex, data: Hex, nonce?: number) {
  const [gas, fees, txNonce] = await Promise.all([
    client.estimateGas({ account, to, data }),
    client.estimateFeesPerGas(),
    nonce ?? client.getTransactionCount({ address: account.address, blockTag: "pending" }),
  ]);
  const serialized = await account.signTransaction({
    chainId: BASE_SEPOLIA.chainId,
    type: "eip1559",
    to,
    data,
    value: BigInt(0),
    nonce: txNonce,
    gas: (gas * BigInt(12)) / BigInt(10),
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  });
  return { serialized, hash: keccak256(serialized), nonce: txNonce };
}

// ---------------------------------------------------------------------------
// Verification (read-only; used by the worker and the public /verify page)
// ---------------------------------------------------------------------------

export type AnchorCheck = { ok: boolean; reason?: string; attestationUid?: Hex; blockNumber?: bigint; revoked?: boolean };

/**
 * Checks on Base Sepolia that the transaction succeeded and created an EAS attestation, by the
 * expected issuer, with our schema, carrying exactly this credential type and proof.
 */
export async function verifyAnchor(
  cfg: Pick<ChainConfig, "rpcUrl">,
  expected: { txHash: Hex; proof: Hex; typeKey: string; issuer: string; attestationUid?: Hex | null },
): Promise<AnchorCheck> {
  const client = publicClientFor(cfg);
  const receipt = await client.getTransactionReceipt({ hash: expected.txHash }).catch(() => null);
  if (!receipt) return { ok: false, reason: "Transaction not found on Base Sepolia (yet)." };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction failed on-chain." };
  const logs = parseEventLogs({ abi: easAbi, eventName: "Attested", logs: receipt.logs }).filter(
    (l) =>
      l.address.toLowerCase() === BASE_SEPOLIA.eas.toLowerCase() &&
      l.args.schemaUID === schemaUid() &&
      l.args.attester.toLowerCase() === expected.issuer.toLowerCase(),
  );
  const uid = logs[0]?.args.uid;
  if (!uid) return { ok: false, reason: "No matching attestation in the transaction." };
  if (expected.attestationUid && expected.attestationUid !== uid) return { ok: false, reason: "Attestation id does not match the record." };

  const att = await client.readContract({ address: BASE_SEPOLIA.eas, abi: easAbi, functionName: "getAttestation", args: [uid] });
  if (att.uid !== uid || att.schema !== schemaUid()) return { ok: false, reason: "Attestation schema does not match." };
  if (att.attester.toLowerCase() !== expected.issuer.toLowerCase()) return { ok: false, reason: "Attestation was not made by the Little Founders issuer." };
  if (att.recipient !== zeroAddress) return { ok: false, reason: "Unexpected attestation recipient." };
  const [type, proof, version] = decodeAbiParameters([{ type: "bytes32" }, { type: "bytes32" }, { type: "uint16" }], att.data);
  if (type !== credentialTypeId(expected.typeKey) || proof.toLowerCase() !== expected.proof.toLowerCase() || version !== 1) {
    return { ok: false, reason: "Attestation data does not match this credential." };
  }
  return { ok: true, attestationUid: uid, blockNumber: receipt.blockNumber, revoked: att.revocationTime !== BigInt(0) };
}

// ---------------------------------------------------------------------------
// Anchoring worker
// ---------------------------------------------------------------------------

type RpcResult = { data: unknown; error: { message: string } | null };
export type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

type Job = {
  id: string;
  status: "pending" | "submitted";
  credential_type: string;
  proof: Hex;
  tx_hash: Hex | null;
  raw_tx: Hex | null;
  nonce: number | null;
};

export type AnchorRunSummary = { claimed: number; submitted: number; confirmed: number; failed: number; waiting: number; blocker: string | null };

const shortError = (e: unknown) => (e instanceof Error ? (e as { shortMessage?: string }).shortMessage ?? e.message : String(e)).slice(0, 300);

/**
 * Processes queued anchoring records. Idempotent and safe to retry:
 *  - pending: sign the attestation locally, store tx hash + signed tx BEFORE broadcasting, then send;
 *  - submitted: look for the receipt; verify the attestation on-chain before marking confirmed;
 *    if not mined, re-broadcast the SAME signed transaction (same hash, so it can never be duplicated);
 *    only if its nonce was used by a different transaction is it marked failed.
 * Pass an Rpc bound to a service-role Supabase client.
 */
export async function runAnchorJobs(rpc: Rpc, cfg: ChainConfig, maxJobs = 5): Promise<AnchorRunSummary> {
  const summary: AnchorRunSummary = { claimed: 0, submitted: 0, confirmed: 0, failed: 0, waiting: 0, blocker: sendingBlocker(cfg) };
  if (summary.blocker) return summary;

  const client = publicClientFor(cfg);
  const account = privateKeyToAccount(cfg.privateKey!);
  const claim = await rpc("claim_credential_anchor_jobs", { max_jobs: maxJobs });
  if (claim.error) throw new Error(`Could not claim anchoring jobs: ${claim.error.message}`);
  const jobs = (claim.data ?? []) as Job[];
  summary.claimed = jobs.length;
  const record = async (id: string, outcome: string, details: Record<string, unknown>) => {
    const res = await rpc("record_credential_anchor", { issuance_id: id, outcome, details });
    const status = (res.data as { status?: string } | null)?.status;
    if (res.error || status !== "ok") throw new Error(`Could not record ${outcome}: ${res.error?.message ?? status}`);
  };

  for (const job of jobs) {
    try {
      let txHash = job.tx_hash;
      let raw = job.raw_tx;
      let nonce = job.nonce;
      if (job.status === "pending") {
        const data = encodeFunctionData({
          abi: easAbi,
          functionName: "attest",
          args: [{
            schema: schemaUid(),
            data: {
              recipient: zeroAddress,
              expirationTime: BigInt(0),
              revocable: SCHEMA_REVOCABLE,
              refUID: zeroHash,
              data: encodeAttestationData(job.credential_type, job.proof),
              value: BigInt(0),
            },
          }],
        });
        let signed;
        try {
          signed = await signCall(client, account, BASE_SEPOLIA.eas, data);
        } catch (e) {
          // Not broadcast: configuration or funding problem. Keep it pending and say why.
          await record(job.id, "release", { error: `Not sent: ${shortError(e)}` });
          summary.waiting++;
          continue;
        }
        txHash = signed.hash;
        raw = signed.serialized;
        nonce = signed.nonce;
        await record(job.id, "submitted", {
          tx_hash: txHash, raw_tx: raw, nonce, issuer_address: account.address, schema_uid: schemaUid(), proof: job.proof,
        });
        summary.submitted++;
        await client.sendRawTransaction({ serializedTransaction: raw }).catch(() => {});
        await client.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 }).catch(() => null);
      }

      const check = await verifyAnchor(cfg, { txHash: txHash!, proof: job.proof, typeKey: job.credential_type, issuer: account.address });
      if (check.ok) {
        await record(job.id, "confirmed", {
          tx_hash: txHash, attestation_uid: check.attestationUid, block_number: Number(check.blockNumber), schema_uid: schemaUid(), proof: job.proof,
        });
        summary.confirmed++;
        continue;
      }
      const receipt = await client.getTransactionReceipt({ hash: txHash! }).catch(() => null);
      if (receipt) {
        // Mined, but reverted or not the attestation we expected: never mark it anchored.
        await record(job.id, "failed", { error: check.reason });
        summary.failed++;
        continue;
      }
      const latestNonce = await client.getTransactionCount({ address: account.address, blockTag: "latest" });
      if (nonce !== null && latestNonce > nonce) {
        await record(job.id, "failed", { error: "The transaction was replaced before it was mined." });
        summary.failed++;
        continue;
      }
      await client.sendRawTransaction({ serializedTransaction: raw! }).catch(() => {});
      await record(job.id, "release", { error: "Waiting for Base Sepolia to include the transaction." });
      summary.waiting++;
    } catch (e) {
      await rpc("record_credential_anchor", { issuance_id: job.id, outcome: "release", details: { error: shortError(e) } });
      summary.waiting++;
    }
  }
  return summary;
}
