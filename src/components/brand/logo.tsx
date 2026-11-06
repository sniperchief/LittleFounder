import Link from "next/link";

import { cn } from "@/lib/utils";

/** Lightbulb-with-sprout mark: an idea that grows. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-9", className)}>
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="var(--sun)" stroke="var(--ink)" strokeWidth="3" />
      <path
        d="M20 9.5c-5 0-8.5 3.6-8.5 8.2 0 3 1.5 5 3.3 6.6.9.8 1.4 1.8 1.4 3v.7h7.6v-.7c0-1.2.5-2.2 1.4-3 1.8-1.6 3.3-3.6 3.3-6.6 0-4.6-3.5-8.2-8.5-8.2Z"
        fill="#fff"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M17 31.5h6" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 24v-5" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M20 19.5c0-2.2 1.6-3.6 3.6-3.6 0 2.2-1.6 3.6-3.6 3.6Z"
        fill="var(--mint)"
        stroke="var(--ink)"
        strokeWidth="1.6"
      />
      <path
        d="M20 21c0-1.9-1.4-3.1-3.1-3.1 0 1.9 1.4 3.1 3.1 3.1Z"
        fill="var(--mint)"
        stroke="var(--ink)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-lg font-display text-[0.95rem] font-extrabold sm:gap-2.5 sm:text-lg tracking-tight text-ink",
        className,
      )}
    >
      <LogoMark className="size-8 sm:size-9" />
      <span>
        LITTLE <span className="text-coral-ink">FOUNDERS</span>
      </span>
    </Link>
  );
}
