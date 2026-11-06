import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Data Access Layer for the signed-in parent. Every protected page AND every server
// action goes through these guards; the database (RLS + SECURITY DEFINER functions)
// enforces the same rules again underneath.

export type AdultContext = {
  userId: string;
  email: string;
  displayName: string;
  hasConsent: boolean;
  hasPin: boolean;
  /** Set while Child Mode is active. Stored in the database, not a cookie. */
  childModeChildId: string | null;
  /** One-click demo account (recorded server-side in demo_accounts; deleted after 48 hours). */
  isDemo: boolean;
};

export const getAdultContext = cache(async (): Promise<AdultContext | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();

  // getUser() verifies the session with the Auth server (not just the cookie).
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [account, consent, pin, demo] = await Promise.all([
    supabase.from("adult_accounts").select("display_name, child_mode_child_id").eq("id", user.id).maybeSingle(),
    supabase.rpc("has_core_consent", { adult: user.id }),
    supabase.rpc("adult_has_pin"),
    supabase.rpc("is_demo_account"),
  ]);

  if (account.error || consent.error || pin.error) {
    throw new Error("Could not load the parent account.");
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    displayName: account.data?.display_name ?? "",
    hasConsent: consent.data === true,
    hasPin: pin.data === true,
    childModeChildId: account.data?.child_mode_child_id ?? null,
    isDemo: demo.data === true,
  };
});

/** Next onboarding step for a parent, or null once onboarding is complete. */
export function nextOnboardingStep(ctx: AdultContext) {
  if (!ctx.displayName) return "/onboarding";
  if (!ctx.hasConsent) return "/onboarding/consent";
  if (!ctx.hasPin) return "/onboarding/pin";
  return null;
}

/** Signed-in parent, any state. Child Mode sends them back to /play. */
export async function requireAdult(): Promise<AdultContext> {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/sign-in");
  if (ctx.childModeChildId) redirect("/play");
  return ctx;
}

/** Parent controls: signed in, NOT in Child Mode, onboarding complete. */
export async function requireParent(): Promise<AdultContext> {
  const ctx = await requireAdult();
  const step = nextOnboardingStep(ctx);
  if (step) redirect(step);
  return ctx;
}

/** Child Mode: signed-in parent account with an active child profile. */
export async function requireChildMode() {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.childModeChildId) redirect("/profiles");

  const supabase = await createClient();
  const { data: child } = await supabase
    .from("child_profiles")
    .select("id, nickname, avatar_key, age_band, is_demo")
    .eq("id", ctx.childModeChildId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!child) redirect("/profiles");

  return { ctx, child, supabase };
}
