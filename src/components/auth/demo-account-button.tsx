"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";

import { startDemoAccountAction } from "@/app/(auth)/demo-actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

/** "Try the demo": a fresh fictional parent account with one demo child, no email needed. */
export function DemoAccountButton() {
  const [state, action] = useActionState(startDemoAccountAction, initialFormState);
  return (
    <section aria-labelledby="demo-title" className="rounded-xl border-2 border-dashed border-ink/40 bg-sun-soft p-5">
      <h2 id="demo-title" className="flex items-center gap-2 text-lg font-bold text-ink">
        <Sparkles className="size-5" aria-hidden="true" /> Just exploring?
      </h2>
      <p className="mt-1 text-sm text-ink/80">
        Try Little Founders with a ready-made demo account: a fictional parent and child, no email needed. The parent PIN is{" "}
        <strong>2580</strong>, and the account is deleted automatically after 48 hours.
      </p>
      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-3">
          {state.message}
        </Alert>
      ) : null}
      <form action={action} className="mt-3">
        <SubmitButton variant="accent" pendingLabel="Setting up your demo…">
          Try the demo
        </SubmitButton>
      </form>
    </section>
  );
}
