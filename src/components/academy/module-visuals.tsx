import { createElement, type ComponentProps } from "react";
import {
  BookOpen,
  Coins,
  Flag,
  Footprints,
  GraduationCap,
  Handshake,
  Lightbulb,
  Presentation,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Shared look for Academy modules and Founder Passport badges.

export type Tone = "sun" | "coral" | "sky" | "mint" | "grape" | "rose";

const icons: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  sparkles: Sparkles,
  users: Users,
  coins: Coins,
  presentation: Presentation,
  handshake: Handshake,
  footprints: Footprints,
  "book-open": BookOpen,
  star: Star,
  flag: Flag,
  "graduation-cap": GraduationCap,
};

export const toneSoft: Record<Tone, string> = {
  sun: "bg-sun-soft",
  coral: "bg-coral-soft",
  sky: "bg-sky-soft",
  mint: "bg-mint-soft",
  grape: "bg-grape-soft",
  rose: "bg-rose-soft",
};

export const toneSolid: Record<Tone, string> = {
  sun: "bg-sun",
  coral: "bg-coral",
  sky: "bg-sky",
  mint: "bg-mint",
  grape: "bg-grape",
  rose: "bg-rose",
};

export function asTone(value: string | null | undefined): Tone {
  return value && value in toneSoft ? (value as Tone) : "sun";
}

/** Renders a module or badge icon by key (falls back to a star). */
export function AppIcon({ name, ...props }: { name: string } & ComponentProps<LucideIcon>) {
  return createElement(icons[name] ?? Star, props);
}

export function ModuleIcon({
  icon,
  tone,
  className,
  iconClassName,
}: {
  icon: string;
  tone: Tone;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink", toneSoft[tone], className)}>
      <AppIcon name={icon} className={cn("size-6 text-ink", iconClassName)} aria-hidden="true" strokeWidth={2.2} />
    </span>
  );
}
