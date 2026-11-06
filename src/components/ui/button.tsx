import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Use `buttonVariants()` on a <Link> for navigation, <Button> for actions.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,box-shadow,background-color] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-2 border-ink bg-ink text-white shadow-[3px_3px_0_0_var(--sun)] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_var(--sun)] active:translate-y-0 active:shadow-none",
        accent:
          "border-2 border-ink bg-sun text-ink shadow-[var(--shadow-sticker)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-sticker-lg)] active:translate-y-0 active:shadow-none",
        secondary: "border-2 border-ink bg-surface text-ink hover:bg-muted",
        ghost: "text-ink hover:bg-muted",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-base",
        lg: "h-13 px-7 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
