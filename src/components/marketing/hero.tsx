import { ArrowRight, Ban, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { InvestorAvatar } from "@/components/illustrations/investor-avatar";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

const trustPoints = [
  { icon: ShieldCheck, label: "Parent-managed profiles" },
  { icon: Lock, label: "Private by default" },
  { icon: Ban, label: "No ads, no chat" },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <Container className="grid items-center gap-14 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
        <div>
          <Badge tone="outline">For curious minds aged 10–13</Badge>
          <h1
            id="hero-title"
            className="mt-6 text-[2.75rem] font-extrabold leading-[1.02] text-ink sm:text-6xl lg:text-[4.25rem]"
          >
            Big ideas{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">start small.</span>
              <svg
                viewBox="0 0 300 20"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute -bottom-1 left-0 z-0 h-4 w-full sm:h-5"
              >
                <path d="M4 14C70 4 180 2 296 10" fill="none" stroke="var(--sun)" strokeWidth="12" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            LITTLE FOUNDERS is where children learn how businesses begin: spotting real problems, shaping ideas,
            running a pretend business and pitching to friendly investor characters.
          </p>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Starting early gives kids a playful way to practise curiosity, problem-solving, money basics and
            speaking up — useful far beyond business.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/get-started" className={buttonVariants({ size: "lg" })}>
              Get started <ArrowRight aria-hidden="true" />
            </Link>
            <Link href="/#how-it-works" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              See how it works
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {trustPoints.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon className="size-4 text-mint" aria-hidden="true" strokeWidth={2.5} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

/** A collage of product moments, using clearly fictional example data. */
function HeroVisual() {
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div aria-hidden="true" className="absolute -right-10 -top-10 size-40 rounded-full bg-sun-soft sm:size-56" />
      <div aria-hidden="true" className="absolute -bottom-6 -left-8 size-32 rounded-full bg-sky-soft" />

      <div aria-hidden="true" className="relative grid gap-4 sm:grid-cols-2">
        {/* Idea card */}
        <div className="rounded-xl border-2 border-ink bg-sun-soft p-5 shadow-[var(--shadow-sticker-lg)] sm:col-span-2 sm:-rotate-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">My idea</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink">Plant Pals 🌱</p>
          <p className="mt-1 text-ink/80">Self-watering pots so classroom plants survive the weekend.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Problem", "Solution", "Customer"].map((step) => (
              <span key={step} className="rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-sm font-semibold text-ink">
                ✓ {step}
              </span>
            ))}
          </div>
        </div>

        {/* Simulator card */}
        <div className="rounded-xl border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker)] sm:rotate-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">Week 3 results</p>
          <div className="mt-3 flex h-20 items-end gap-2">
            {[38, 55, 80].map((height, i) => (
              <div
                key={height}
                className="flex-1 rounded-t-md border-2 border-ink"
                style={{ height: `${height}%`, background: i === 2 ? "var(--mint)" : "var(--mint-soft)" }}
              />
            ))}
          </div>
          <p className="mt-3 font-display text-2xl font-extrabold text-ink">+72 FB profit</p>
          <p className="text-xs font-semibold text-muted-foreground">FB = Founder Bucks (pretend money)</p>
        </div>

        {/* Investor card */}
        <div className="rounded-xl border-2 border-ink bg-grape-soft p-5 shadow-[var(--shadow-sticker)] sm:-rotate-2">
          <div className="flex items-center gap-3">
            <InvestorAvatar investor="penny" className="size-12" />
            <p className="font-display text-lg font-bold text-ink">Penny the Planner</p>
          </div>
          <p className="mt-3 rounded-lg border-2 border-ink bg-surface px-3 py-2 font-semibold text-ink">
            “How much does each pot cost to make?”
          </p>
        </div>
      </div>
      <figcaption className="relative mt-5 text-center text-sm text-muted-foreground lg:text-left">
        Illustration with fictional example data.
      </figcaption>
    </figure>
  );
}
