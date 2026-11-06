import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const steps = ["Your name", "Agreement", "Parent PIN"] as const;

export function OnboardingShell({
  step,
  title,
  description,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <ol className="flex items-center gap-2" aria-label="Setup progress">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-ink text-sm font-extrabold",
                  done ? "bg-mint text-ink" : current ? "bg-sun text-ink" : "bg-surface text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : n}
              </span>
              <span className={cn("text-sm font-semibold", current ? "text-ink" : "text-muted-foreground")}>
                {label}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
              {n < steps.length ? <span aria-hidden="true" className="hidden h-0.5 flex-1 bg-border sm:block" /> : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-8 rounded-xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
        {description ? <div className="mt-2 leading-relaxed text-muted-foreground">{description}</div> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
