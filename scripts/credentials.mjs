// Credential anchoring operations on Base Sepolia (testnet only). See docs/CREDENTIALS.md §4–§6.
//
//   npm run credentials -- check             read-only: network, EAS contracts, schema UID (simulated
//                                            registration), schema status, issuer address and balance
//   npm run credentials -- new-key           creates a testnet issuer key in .env.local (prints the address only)
//   npm run credentials -- register-schema   one-off: registers the credential schema from the issuer
//   npm run credentials -- anchor            processes queued anchoring records (run on a schedule)
//
// Reads .env.local: CREDENTIAL_ISSUER_PRIVATE_KEY, CREDENTIAL_ANCHORING_ENABLED, BASE_SEPOLIA_RPC_URL
// (optional), NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (anchor only). Never prints the key.
import { createClient } from "@supabase/supabase-js";
import { formatEther } from "viem";

const eas = await import("../src/lib/credentials/eas.ts");
const cfg = eas.chainConfigFromEnv(process.env);
const command = process.argv[2] ?? "check";

if (command === "check") {
  const s = await eas.networkStatus(cfg);
  const simulated = await eas.simulateSchemaUid(cfg).catch((e) => `simulation reverted (${e.shortMessage ?? e.message})`);
  console.log(`RPC                 ${new URL(cfg.rpcUrl).host}`);
  console.log(`Chain id            ${s.chainId} ${s.chainOk ? "✓ Base Sepolia" : "✗ NOT Base Sepolia"}`);
  console.log(`EAS                 ${eas.BASE_SEPOLIA.eas} version ${s.easVersion}`);
  console.log(`SchemaRegistry      ${eas.BASE_SEPOLIA.schemaRegistry} ${s.registryOk ? "✓ matches EAS.getSchemaRegistry()" : "✗ mismatch"}`);
  console.log(`Schema              "${eas.SCHEMA}" (no resolver, revocable)`);
  console.log(`Schema UID          ${s.schemaUid}`);
  console.log(`Registry would give ${typeof simulated === "string" && simulated.startsWith("0x") ? `${simulated} ${simulated === s.schemaUid ? "✓ same" : "✗ DIFFERENT"}` : simulated}`);
  console.log(`Schema registered   ${s.schemaRegistered ? (s.schemaMatches ? "yes ✓" : "yes, but fields differ ✗") : "no (run register-schema)"}`);
  console.log(`Issuer              ${s.issuer ?? "not configured (CREDENTIAL_ISSUER_PRIVATE_KEY)"}`);
  if (s.issuer) console.log(`Issuer balance      ${formatEther(s.issuerBalanceWei)} ETH (Base Sepolia test ETH)`);
  console.log(`Sending             ${eas.sendingBlocker(cfg) ?? "enabled"}`);
  process.exit(s.chainOk && s.registryOk ? 0 : 1);
}

if (command === "new-key") {
  // Creates a fresh Base Sepolia issuer key and appends it to .env.local. Prints only the address.
  const { appendFileSync, readFileSync } = await import("node:fs");
  const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
  const envFile = new URL("../.env.local", import.meta.url);
  if (/^CREDENTIAL_ISSUER_PRIVATE_KEY=.+/m.test(readFileSync(envFile, "utf8"))) {
    console.error("CREDENTIAL_ISSUER_PRIVATE_KEY is already set in .env.local — not replacing it.");
    process.exit(1);
  }
  const key = generatePrivateKey();
  appendFileSync(envFile, `\n# Base Sepolia (testnet) credential issuer — server only, never commit\nCREDENTIAL_ISSUER_PRIVATE_KEY=${key}\nCREDENTIAL_ANCHORING_ENABLED=true\n`);
  console.log(`New testnet issuer address: ${privateKeyToAccount(key).address}`);
  console.log("Saved to .env.local. Fund this address with Base Sepolia test ETH, then run: npm run credentials -- check");
  process.exit(0);
}

if (command === "register-schema") {
  const r = await eas.registerSchema(cfg);
  console.log(r.alreadyRegistered ? `Schema already registered: ${r.uid}` : `Registered schema ${r.uid} in ${eas.txUrl(r.txHash)}`);
  process.exit(0);
}

if (command === "anchor") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
    process.exit(2);
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const summary = await eas.runAnchorJobs((fn, args) => admin.rpc(fn, args), cfg, 20);
  console.log(JSON.stringify(summary));
  process.exit(summary.blocker ? 3 : 0);
}

console.error(`Unknown command "${command}". Use check, register-schema or anchor.`);
process.exit(2);
