import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Get started",
  description: "How families join LITTLE FOUNDERS during the preview.",
};

const setupSteps = [
  {
    title: "Create your parent account",
    body: "Sign up with your email address. Accounts are for adults only.",
  },
  {
    title: "Read how we handle data, and agree",
    body: "A short, plain-language notice explains exactly what we store and why, before anything is created for your child.",
  },
  {
    title: "Choose a parent PIN, then add a child profile",
    body: "Just a nickname, an avatar and an age range (10–11 or 12–13). No photos, school or birthday.",
  },
  {
    title: "Hand over your device in Child Mode",
    body: "Your child starts learning; your parent PIN keeps your dashboard and settings separate.",
  },
];

export default function GetStartedPage() {
  return (
    <section aria-labelledby="get-started-title" className="py-14 sm:py-20">
      <Container className="max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
        </Link>

        <Badge tone="sun" className="mt-8">
          <Clock aria-hidden="true" /> Early preview
        </Badge>
        <h1 id="get-started-title" className="mt-4 text-4xl font-extrabold text-ink sm:text-5xl">
          Parent accounts are in preview
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          We’re building LITTLE FOUNDERS carefully. You can create a parent account and try the setup today, but
          until our independent privacy and safety review is complete, please use{" "}
          <strong className="text-ink">fictional nicknames only</strong> for child profiles — because children’s
          data deserves extra care.
        </p>

        <div className="mt-12 rounded-xl border-2 border-ink bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-ink">How setting up works</h2>
          <ol className="mt-6 space-y-6">
            {setupSteps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun font-display font-extrabold text-ink"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" className={buttonVariants()}>
            Create a parent account
          </Link>
          <Link href="/sign-in" className={buttonVariants({ variant: "secondary" })}>
            Sign in
          </Link>
          <Link href="/privacy" className={buttonVariants({ variant: "ghost" })}>
            Our privacy approach
          </Link>
        </div>
      </Container>
    </section>
  );
}
