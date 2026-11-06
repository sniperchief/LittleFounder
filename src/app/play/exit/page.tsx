import type { Metadata } from "next";
import { Suspense } from "react";

import { forgotPinAction } from "@/app/(auth)/actions";
import { ExitChildModeForm } from "@/components/children/exit-child-mode-form";
import { getAdultContext } from "@/lib/auth/session";
import { DEMO_PIN } from "@/lib/demo";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Grown-ups only" };

export default function ExitChildModePage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-2xl border-2 border-ink bg-surface p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">Grown-ups only</h1>
        <p className="mt-2 text-muted-foreground">Enter the parent PIN to leave Child Mode.</p>
        <Suspense fallback={null}>
          <Guard />
        </Suspense>
        <div className="mt-6">
          <ExitChildModeForm />
        </div>
        <form action={forgotPinAction} className="mt-6 border-t border-border pt-5">
          <button type="submit" className="text-sm font-semibold text-muted-foreground underline underline-offset-4 hover:text-ink">
            Forgot the PIN? Sign in again with your password
          </button>
        </form>
      </div>
    </div>
  );
}

/** Not in Child Mode (or signed out)? Nothing to unlock. */
async function Guard() {
  const ctx = await getAdultContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.childModeChildId) redirect("/parent");
  return ctx.isDemo ? (
    <p className="mt-3 rounded-lg bg-sun-soft px-3 py-2 text-sm font-semibold text-ink">Demo account: the parent PIN is {DEMO_PIN}.</p>
  ) : null;
}
