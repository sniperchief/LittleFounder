"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState, useTransition } from "react";

import { saveReflectionAction } from "@/app/play/simulator/actions";
import { Button } from "@/components/ui/button";
import { reflectionOptions } from "@/content/simulator";
import { cn } from "@/lib/utils";

export function ReflectionForm({ sessionId }: { sessionId: string }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (saved) {
    return (
      <p role="status" className="rounded-xl bg-grape-soft px-4 py-3 font-semibold text-ink">
        Thanks! Your answer is saved: {reflectionOptions.find((o) => o.key === choice)?.label}.
      </p>
    );
  }

  return (
    <section aria-labelledby="reflect" className="rounded-2xl border-2 border-ink bg-grape-soft p-5 sm:p-6">
      <h2 id="reflect" className="flex items-center gap-2 text-xl font-bold text-ink">
        <MessageCircleQuestion className="size-6" aria-hidden="true" /> Think about it
      </h2>
      <p className="mt-1 text-ink/85">If you ran this business again, what would you change first?</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What would you change?">
        {reflectionOptions.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={choice === o.key}
            onClick={() => setChoice(o.key)}
            className={cn(
              "rounded-xl border-2 px-4 py-3 text-left font-semibold text-ink",
              choice === o.key ? "border-ink bg-surface shadow-[var(--shadow-sticker)]" : "border-ink/20 bg-surface/70 hover:border-ink/60",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 font-semibold text-coral-ink">{error}</p> : null}
      <Button
        type="button"
        className="mt-4"
        disabled={!choice || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await saveReflectionAction(sessionId, choice ?? "");
            if (res.status === "ok") setSaved(true);
            else setError(res.message);
          })
        }
      >
        {pending ? "Saving…" : "Save my answer"}
      </Button>
    </section>
  );
}
