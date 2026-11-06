import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}

type SectionProps = ComponentProps<"section"> & { containerClassName?: string };

export function Section({ className, containerClassName, children, ...props }: SectionProps) {
  return (
    <section className={cn("py-16 sm:py-24", className)} {...props}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
  /** id for the heading, so the section can use aria-labelledby */
  id?: string;
};

export function SectionHeader({ eyebrow, title, description, align = "center", className, id }: SectionHeaderProps) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="text-3xl font-extrabold text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
        {title}
      </h2>
      {description ? <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  );
}
