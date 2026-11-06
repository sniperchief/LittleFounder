import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="py-16 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border-2 border-ink bg-coral-soft px-6 py-14 text-center shadow-[var(--shadow-sticker-lg)] sm:px-12">
          <div aria-hidden="true" className="absolute -left-12 -top-12 size-40 rounded-full bg-sun/50" />
          <div aria-hidden="true" className="absolute -bottom-16 -right-10 size-48 rounded-full bg-sky-soft" />
          <div className="relative">
            <h2 id="final-cta-title" className="mx-auto max-w-2xl text-3xl font-extrabold text-ink sm:text-5xl">
              Every big business started as a small idea
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-ink/80">
              Give your child a safe, playful place to find theirs — with you in charge.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/get-started" className={buttonVariants({ size: "lg" })}>
                Get started <ArrowRight aria-hidden="true" />
              </Link>
              <Link href="/privacy" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Our privacy approach
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
