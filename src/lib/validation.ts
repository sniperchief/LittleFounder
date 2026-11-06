import { z } from "zod";

import { avatarKeys } from "@/content/avatars";

// Server-side validation for every form in the parent and child areas.

export const CONSENT_NOTICE_VERSION = "2026-11-preview-1";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use 72 characters or fewer.");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  adult: z.literal("on", { error: "Please confirm you are a parent or guardian aged 18 or over." }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter the name you'd like us to use.")
    .max(80, "Use 80 characters or fewer."),
});

export const consentSchema = z.object({
  typedName: z.string().trim().min(2, "Type your full name to confirm.").max(120),
  guardian: z.literal("on", { error: "Please confirm you are the child's parent or legal guardian." }),
  notice: z.literal("on", { error: "Please confirm you have read the notice." }),
  preview: z.literal("on", { error: "Please confirm you understand the preview terms." }),
});

const pin = z.string().regex(/^[0-9]{4,6}$/, "Use 4 to 6 digits.");

export const pinSetupSchema = z
  .object({ pin, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { message: "The PINs don't match.", path: ["confirmPin"] });

export const pinChangeSchema = z
  .object({ currentPin: z.string().min(1, "Enter your current PIN."), pin, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { message: "The PINs don't match.", path: ["confirmPin"] });

export const pinEntrySchema = z.object({ pin: z.string().regex(/^[0-9]{4,6}$/, "Enter your 4–6 digit PIN.") });

/** Nickname guidance: no full names, contact details or numbers that look like phone numbers. */
export const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(20, "Use 20 characters or fewer.")
  .regex(/^[\p{L}\p{N} '\-]+$/u, "Use letters, numbers, spaces, hyphens or apostrophes only.")
  .refine((v) => !/\d{4,}/.test(v), "Please don't include long numbers.")
  .refine((v) => v.split(/\s+/).length <= 2, "A first name or nickname is plenty — no full names.");

export const childProfileSchema = z.object({
  nickname: nicknameSchema,
  ageBand: z.enum(["10-11", "12-13"], { error: "Choose an age range." }),
  avatarKey: z.enum(avatarKeys, { error: "Choose an avatar." }),
});

export const uuidSchema = z.string().uuid();

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echo non-sensitive values back so forms keep their input after an error. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
