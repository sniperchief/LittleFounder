"use server";

import { createHmac, randomBytes } from "node:crypto";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_PIN, demoAccountsEnabled } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation";

// "Try the demo": creates a fresh, already-confirmed, fully fictional parent account with one demo
// child and signs the visitor in, so evaluators don't need a confirmation email. Off unless
// DEMO_ACCOUNTS_ENABLED=true. Rate-limited and deleted automatically after 48 hours
// (supabase/migrations/20261106001200_demo_accounts.sql).

const childNames = ["Demo Nova", "Demo Kai", "Demo Zara", "Demo Leo", "Demo Mira", "Demo Theo"];
const avatars = ["founder-1", "founder-2", "founder-3", "founder-4", "founder-5", "founder-6"];
const pick = <T,>(list: T[]) => list[randomBytes(1)[0] % list.length];

const unavailable = "Demo accounts aren't available right now. Please create a parent account instead.";

export async function startDemoAccountAction(): Promise<FormState> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!demoAccountsEnabled() || !url || !secret) return { status: "error", message: unavailable };

  // Visitor identity for rate limiting: a keyed hash of the IP, never the IP itself.
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const clientHash = createHmac("sha256", secret).update(`demo-account:${ip}`).digest("hex");

  const admin = createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: allowed } = await admin.rpc("demo_account_allowed", { client_hash: clientHash });
  if (allowed === "rate_limited") return { status: "error", message: "You've made a few demo accounts already. Please try again in an hour." };
  if (allowed !== "ok") return { status: "error", message: unavailable };

  const email = `demo-${randomBytes(6).toString("hex")}@example.com`;
  const password = randomBytes(24).toString("base64url");
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created?.user?.id;
  if (createError || !userId) return { status: "error", message: unavailable };

  const supabase = await createClient();
  const ok = await (async () => {
    if ((await admin.rpc("register_demo_account", { user_id: userId, client_hash: clientHash })).data !== "ok") return false;
    if ((await supabase.auth.signInWithPassword({ email, password })).error) return false;
    // Onboarding as the new parent, through the same rules as a real sign-up (RLS + functions).
    if ((await supabase.from("adult_accounts").update({ display_name: "Demo Parent" }).eq("id", userId)).error) return false;
    const consent = await supabase.from("consent_records").insert({
      guardian_id: userId,
      consent_type: "core_processing",
      notice_version: "demo-account",
      typed_name: "Demo Parent (demo account)",
    });
    if (consent.error) return false;
    if ((await supabase.rpc("set_adult_pin", { new_pin: DEMO_PIN })).data !== "ok") return false;
    const child = await supabase
      .from("child_profiles")
      .insert({ guardian_id: userId, nickname: pick(childNames), age_band: "10-11", avatar_key: pick(avatars), is_demo: true });
    return !child.error;
  })();

  if (!ok) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: unavailable };
  }

  revalidatePath("/", "layout");
  redirect("/parent?demo=1");
}
