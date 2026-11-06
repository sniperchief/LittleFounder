import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const tones = {
  info: { icon: Info, className: "border-sky/40 bg-sky-soft" },
  success: { icon: CircleCheck, className: "border-mint/50 bg-mint-soft" },
  error: { icon: CircleAlert, className: "border-coral/50 bg-coral-soft" },
  warning: { icon: CircleAlert, className: "border-sun bg-sun-soft" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border-2 px-4 py-3 text-ink", toneClass, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1 text-[0.95rem] leading-relaxed [overflow-wrap:anywhere]">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
