"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdult, requireParent } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  CONSENT_NOTICE_VERSION,
  childProfileSchema,
  consentSchema,
  displayNameSchema,
  fieldErrorsFrom,
  pinChangeSchema,
  pinSetupSchema,
  uuidSchema,
  type FormState,
} from "@/lib/validation";

// Every action re-checks the session server-side (requireAdult / requireParent) and
// relies on RLS + SECURITY DEFINER functions in the database as the final authority.

const pinMessages: Record<string, string> = {
  too_simple: "That PIN is too easy to guess. Avoid repeated or sequential digits.",
  invalid_format: "Use 4 to 6 digits.",
  wrong_pin: "Your current PIN isn't right.",
  locked: "Too many wrong attempts. Please wait 15 minutes and try again.",
  child_mode_active: "Leave Child Mode before changing your PIN.",
};

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function saveDisplayNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireAdult();
  const parsed = displayNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("adult_accounts")
    .update({ display_name: parsed.data.displayName })
    .eq("id", ctx.userId);
  if (error) return { status: "error", message: "We couldn't save your name. Please try again." };

  revalidatePath("/", "layout");
  if (formData.get("from") === "settings") return { status: "success", message: "Your name has been updated." };
  redirect("/onboarding/consent");
}

export async function recordConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireAdult();
  if (!ctx.displayName) redirect("/onboarding");
  if (ctx.hasConsent) redirect("/onboarding/pin");

  const parsed = consentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { typedName: String(formData.get("typedName") ?? "") },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("consent_records").insert({
    guardian_id: ctx.userId,
    consent_type: "core_processing",
    notice_version: CONSENT_NOTICE_VERSION,
    typed_name: parsed.data.typedName,
  });
  if (error) return { status: "error", message: "We couldn't record your agreement. Please try again." };

  revalidatePath("/", "layout");
  redirect("/onboarding/pin");
}

export async function setPinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireAdult();
  if (!ctx.hasConsent) redirect("/onboarding/consent");

  const parsed = pinSetupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  if (ctx.hasPin) return { status: "error", message: "You already have a PIN. Change it in Settings." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_adult_pin", { new_pin: parsed.data.pin });
  if (error) return { status: "error", message: "We couldn't save your PIN. Please try again." };
  if (data !== "ok") return { status: "error", fieldErrors: { pin: pinMessages[data] ?? "Please try another PIN." } };

  revalidatePath("/", "layout");
  redirect("/parent?welcome=1");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function changePinAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireParent();
  const parsed = pinChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_adult_pin", {
    new_pin: parsed.data.pin,
    current_pin: parsed.data.currentPin,
  });
  if (error) return { status: "error", message: "We couldn't change your PIN. Please try again." };
  if (data !== "ok") {
    const field = data === "wrong_pin" || data === "locked" ? "currentPin" : "pin";
    return { status: "error", fieldErrors: { [field]: pinMessages[data] ?? "Please try another PIN." } };
  }
  return { status: "success", message: "Your parent PIN has been changed." };
}

// ---------------------------------------------------------------------------
// Child profiles
// ---------------------------------------------------------------------------

function childValues(formData: FormData) {
  return {
    nickname: String(formData.get("nickname") ?? ""),
    ageBand: String(formData.get("ageBand") ?? ""),
    avatarKey: String(formData.get("avatarKey") ?? ""),
  };
}

export async function createChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requireParent();
  const values = childValues(formData);
  const parsed = childProfileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("child_profiles").insert({
    guardian_id: ctx.userId,
    nickname: parsed.data.nickname,
    age_band: parsed.data.ageBand,
    avatar_key: parsed.data.avatarKey,
    // Real child data stays off until the privacy/legal review is complete.
    // The database enforces this too (app_settings.real_child_data_enabled).
    is_demo: process.env.REAL_CHILD_DATA_ENABLED !== "true",
  });

  if (error) {
    const limit = error.message.includes("at most 8");
    return {
      status: "error",
      message: limit ? "A family can have up to 8 child profiles." : "We couldn't create the profile. Please try again.",
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect("/parent?created=1");
}

export async function updateChildAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireParent();
  const id = uuidSchema.safeParse(formData.get("childId"));
  const values = childValues(formData);
  const parsed = childProfileSchema.safeParse(values);
  if (!id.success) return { status: "error", message: "That profile couldn't be found." };
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("child_profiles")
    .update({ nickname: parsed.data.nickname, age_band: parsed.data.ageBand, avatar_key: parsed.data.avatarKey })
    .eq("id", id.data)
    .is("deleted_at", null)
    .select("id");
  if (error || !data?.length) return { status: "error", message: "We couldn't save the changes.", values };

  revalidatePath("/", "layout");
  redirect(`/parent/children/${id.data}?updated=1`);
}

export async function removeChildAction(formData: FormData) {
  await requireParent();
  const id = uuidSchema.safeParse(formData.get("childId"));
  if (!id.success || formData.get("confirm") !== "remove") redirect("/parent");

  const supabase = await createClient();
  // Soft delete: the database stamps the time, schedules permanent deletion in
  // 30 days, writes the audit log and ends Child Mode for this profile.
  await supabase.from("child_profiles").update({ deleted_at: new Date().toISOString() }).eq("id", id.data);

  revalidatePath("/", "layout");
  redirect("/parent?removed=1");
}

export async function restoreChildAction(formData: FormData) {
  await requireParent();
  const id = uuidSchema.safeParse(formData.get("childId"));
  if (!id.success) redirect("/parent/settings");

  const supabase = await createClient();
  await supabase.from("child_profiles").update({ deleted_at: null }).eq("id", id.data);

  revalidatePath("/", "layout");
  redirect("/parent?restored=1");
}

// ---------------------------------------------------------------------------
// Child Mode
// ---------------------------------------------------------------------------

export async function enterChildModeAction(formData: FormData) {
  await requireParent();
  const id = uuidSchema.safeParse(formData.get("childId"));
  if (!id.success) redirect("/profiles");

  const supabase = await createClient();
  const { data } = await supabase.rpc("enter_child_mode", { child: id.data });
  if (data === "pin_required") redirect("/onboarding/pin");
  if (data !== "ok") redirect("/profiles");

  // Drop cached parent pages from the client router so "Back" can't show them.
  revalidatePath("/", "layout");
  redirect("/play");
}
