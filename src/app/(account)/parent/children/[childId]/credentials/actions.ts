"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { requireParent } from "@/lib/auth/session";
import { ANCHORING_NOTICE_VERSION } from "@/lib/credentials/canonical";
import { processAnchoringQueue } from "@/lib/credentials/server";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, uuidSchema, type FormState } from "@/lib/validation";

// Parent-only credential anchoring controls. requireParent() refuses Child Mode; the database
// functions check guardianship, core consent and Child Mode again.

const enableSchema = z.object({
  childId: uuidSchema,
  typedName: z.string().trim().min(2, "Type your full name to confirm.").max(120),
  public: z.literal("on", { error: "Please confirm you understand the proof is public and permanent." }),
  anonymous: z.literal("on", { error: "Please confirm you understand no personal information is included." }),
  withdraw: z.literal("on", { error: "Please confirm you understand what withdrawing does." }),
});

const messages: Record<string, string> = {
  invalid: "Something didn't look right. Please check the form and try again.",
  rate_limited: "That's a lot of changes in a short time. Please try again later.",
  consent_required: "Please complete the main parental consent first.",
  not_found: "We couldn't find that child profile.",
  child_mode_active: "Leave Child Mode before changing parent settings.",
};

const pageFor = (childId: string) => `/parent/children/${childId}/credentials`;

export async function enableAnchoringAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireParent();
  const parsed = enableSchema.safeParse(Object.fromEntries(formData));
  const values = { typedName: String(formData.get("typedName") ?? "") };
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_credential_anchoring", {
    child: parsed.data.childId,
    enable: true,
    typed_name: parsed.data.typedName,
    notice_version: ANCHORING_NOTICE_VERSION,
  });
  if (error || data?.status !== "ok") {
    return { status: "error", message: messages[data?.status ?? "invalid"] ?? messages.invalid, values };
  }
  after(() => processAnchoringQueue());
  revalidatePath(pageFor(parsed.data.childId));
  redirect(`${pageFor(parsed.data.childId)}?enabled=1`);
}

export async function withdrawAnchoringAction(formData: FormData) {
  await requireParent();
  const childId = uuidSchema.safeParse(formData.get("childId"));
  if (!childId.success) redirect("/parent");
  if (formData.get("confirm") !== "withdraw") redirect(`${pageFor(childId.data)}?error=confirm`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("set_credential_anchoring", { child: childId.data, enable: false });
  revalidatePath(pageFor(childId.data));
  redirect(`${pageFor(childId.data)}?${data?.status === "ok" ? "withdrawn=1" : `error=${encodeURIComponent(data?.status ?? "invalid")}`}`);
}

export async function retryAnchoringAction(formData: FormData) {
  await requireParent();
  const childId = uuidSchema.safeParse(formData.get("childId"));
  const certificateId = uuidSchema.safeParse(formData.get("certificateId"));
  if (!childId.success || !certificateId.success) redirect("/parent");
  const supabase = await createClient();
  const { data } = await supabase.rpc("retry_credential_anchoring", { certificate_id: certificateId.data });
  if (data?.status === "ok") after(() => processAnchoringQueue());
  revalidatePath(pageFor(childId.data));
  redirect(`${pageFor(childId.data)}?${data?.status === "ok" ? "retrying=1" : `error=${encodeURIComponent(data?.status ?? "invalid")}`}`);
}

/** "Check progress": runs the queue now (bounded, idempotent) instead of waiting for the scheduled run. */
export async function checkAnchoringAction(formData: FormData) {
  await requireParent();
  const childId = uuidSchema.safeParse(formData.get("childId"));
  if (!childId.success) redirect("/parent");
  await processAnchoringQueue(5);
  revalidatePath(pageFor(childId.data));
  redirect(`${pageFor(childId.data)}?checked=1`);
}
