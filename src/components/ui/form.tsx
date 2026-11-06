import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Shared form styles. Used by Phase 2+ forms (sign-up, consent, Idea Lab).

const fieldBase =
  "w-full rounded-md border-2 border-border bg-surface px-4 text-base text-ink placeholder:text-muted-foreground/80 transition-colors hover:border-ink/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-coral disabled:cursor-not-allowed disabled:opacity-60";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function FieldHint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return <p role="alert" className={cn("text-sm font-semibold text-coral-ink", className)} {...props} />;
}
