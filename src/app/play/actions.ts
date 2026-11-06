"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdultContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { pinEntrySchema, type FormState } from "@/lib/validation";

/** Leave Child Mode. The PIN is checked (and attempts limited) inside the database. */
export async function exitChildModeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/sign-in");

  const parsed = pinEntrySchema.safeParse({ pin: formData.get("pin") });
  if (!parsed.success) return { status: "error", fieldErrors: { pin: parsed.error.issues[0].message } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("exit_child_mode", { pin: parsed.data.pin });
  if (error) return { status: "error", message: "Something went wrong. Please try again." };
  if (data === "locked") {
    return { status: "error", fieldErrors: { pin: "Too many wrong tries. Please wait 15 minutes." } };
  }
  if (data !== "ok") return { status: "error", fieldErrors: { pin: "That PIN isn't right." } };

  revalidatePath("/", "layout");
  redirect(formData.get("to") === "profiles" ? "/profiles" : "/parent");
}
