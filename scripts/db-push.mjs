// Applies supabase/migrations to the hosted project in SUPABASE_DB_URL, then applies the
// curriculum seed. Usage: npm run db:push   (add --dry-run to preview migrations only)
//
// The Supabase CLI only runs a seed file once (later changes just update its hash), so
// the seed — which is idempotent — is applied explicitly every time, as one statement.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL in .env.local (Supabase → Connect → Session pooler connection string).");
  process.exit(2);
}

const dryRun = process.argv.includes("--dry-run");
const mask = (text) => (text ?? "").replace(/:[^:@/\s]+@/g, ":***@");
function supabase(args) {
  const result = spawnSync("npx", ["supabase", ...args], { encoding: "utf8", shell: process.platform === "win32" });
  process.stdout.write(mask(result.stdout));
  process.stderr.write(mask(result.stderr).replace(/^.*(DEP0190|trace-deprecation).*\n/gm, ""));
  return result.status ?? 1;
}

const pushArgs = ["db", "push", "--db-url", dbUrl, "--yes"];
if (dryRun) pushArgs.push("--dry-run");
let status = supabase(pushArgs);
if (status !== 0 || dryRun) process.exit(status);

const seed = readFileSync(join(import.meta.dirname, "..", "supabase", "seed.sql"), "utf8");
if (seed.includes("$seed$")) throw new Error("seed.sql must not contain $seed$");
const dir = mkdtempSync(join(tmpdir(), "lf-seed-"));
const file = join(dir, "seed.sql");
writeFileSync(file, `do $seed$\nbegin\n${seed}\nend\n$seed$;\n`);
console.log("Applying curriculum seed…");
status = supabase(["db", "query", `--remote=${dbUrl}`, "-f", file, "--yes", "--output-format", "json"]);
rmSync(dir, { recursive: true, force: true });
process.exit(status);
