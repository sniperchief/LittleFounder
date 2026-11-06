"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin, safeNextPath } from "@/lib/site-url";
import {
  emailSchema,
  fieldErrorsFrom,
  passwordSchema,
  signInSchema,
  signUpSchema,
  type FormState,
} from "@/lib/validation";

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });

  if (error) {
    const messages: Record<string, string> = {
      weak_password: "Please choose a stronger password.",
      over_email_send_rate_limit: "We can't send confirmation emails right now. Please try again in an hour.",
      email_address_not_authorized: "We couldn't send a confirmation email to that address. Please try another email.",
    };
    // The auth server reports SMTP failures generically (e.g. 500 "Error sending confirmation email").
    const emailFailed = /sending .*email/i.test(error.message);
    return {
      status: "error",
      message:
        messages[error.code ?? ""] ??
        (emailFailed
          ? "We couldn't send a confirmation email right now. Please try again later."
          : "We couldn't create your account. Please try again."),
      values,
    };
  }

  // Email confirmation disabled → signed in immediately.
  if (data.session) redirect("/onboarding");

  // Supabase returns no error for already-registered emails (to prevent account
  // enumeration), so the message is the same either way.
  return {
    status: "success",
    message: `Check ${parsed.data.email} for a link to confirm your account. Then come back here to sign in.`,
  };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    const unconfirmed = error.code === "email_not_confirmed";
    return {
      status: "error",
      message: unconfirmed
        ? "Please confirm your email address first — check your inbox for the link."
        : "That email and password don't match. Please try again.",
      values,
    };
  }

  // Forgotten-PIN recovery: a fresh password sign-in clears the PIN and Child Mode.
  if (formData.get("reset_pin") === "1") {
    const { data } = await supabase.rpc("reset_pin_after_password_auth");
    revalidatePath("/", "layout");
    if (data === "ok") redirect("/onboarding/pin?reset=1");
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/** "Forgot your PIN?" from Child Mode: sign out, then sign in again with the password. */
export async function forgotPinAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in?reset_pin=1");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", fieldErrors: { email: parsed.error.issues[0].message } };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Same response whether or not the account exists.
  return {
    status: "success",
    message: "If an account exists for that email, we've sent a link to reset your password.",
  };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { status: "error", fieldErrors: { password: password.error.issues[0].message } };
  if (formData.get("password") !== formData.get("confirmPassword")) {
    return { status: "error", fieldErrors: { confirmPassword: "The passwords don't match." } };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/sign-in");

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    return {
      status: "error",
      message:
        error.code === "same_password"
          ? "Please choose a password you haven't used before."
          : "We couldn't update your password. The reset link may have expired — request a new one.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/parent");
}
