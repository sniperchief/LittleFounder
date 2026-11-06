import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-ink [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-muted",
        sun: "bg-sun-soft",
        coral: "bg-coral-soft",
        sky: "bg-sky-soft",
        mint: "bg-mint-soft",
        grape: "bg-grape-soft",
        rose: "bg-rose-soft",
        outline: "border-2 border-ink bg-surface",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
