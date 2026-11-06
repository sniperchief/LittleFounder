import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Shared full-page message used by not-found, error and empty states. */
export function StatusPanel({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:py-28", className)}>
      <LogoMark className="size-14" />
      <h1 className="mt-6 text-3xl font-extrabold text-ink sm:text-4xl">{title}</h1>
      {description ? <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{description}</p> : null}
      {actions ? <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div> : null}
    </div>
  );
}
