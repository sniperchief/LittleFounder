import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Our privacy approach",
  description: "How LITTLE FOUNDERS is designed to protect children’s privacy.",
};

const commitments = [
  {
    title: "Parents are in control",
    body: "Only adults can create accounts. A parent or guardian agrees to how data is used before a child profile can be created, and can withdraw that agreement at any time.",
  },
  {
    title: "We collect as little as possible",
    body: "For a child we store a nickname, a chosen avatar, an age range and their learning activity. We don’t ask for real names, birthdays, photos, schools, locations or contact details.",
  },
  {
    title: "Children’s work is private",
    body: "Ideas, simulations, pitches and progress are visible only to the parent who manages the profile. There are no public profiles, leaderboards or galleries.",
  },
  {
    title: "No contact with strangers",
    body: "There is no chat, messaging, commenting or friend list. Investor characters are scripted — there are no real people on the other side.",
  },
  {
    title: "No ads, no tracking, no AI services",
    body: "We don’t show advertising, use third-party trackers in children’s areas, or send children’s work to external AI services.",
  },
  {
    title: "No real money or crypto",
    body: "The Startup Simulator uses clearly labelled pretend money. Children never need a wallet, cryptocurrency or any payment method.",
  },
  {
    title: "Easy to download or delete",
    body: "Parents can remove a child’s profile at any time; it is permanently deleted after a 30-day grace period. Downloading a copy of the data is coming soon.",
  },
];

export default function PrivacyPage() {
  return (
    <article aria-labelledby="privacy-title" className="py-14 sm:py-20">
      <Container className="max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-muted-foreground hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to home
        </Link>

        <Badge tone="sky" className="mt-8">
          Summary · not our full privacy notice
        </Badge>
        <h1 id="privacy-title" className="mt-4 text-4xl font-extrabold text-ink sm:text-5xl">
          Our privacy approach
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
          LITTLE FOUNDERS is built for children, so privacy is part of the design from the start. This page
          summarises the principles we’re building to. Our full privacy notice — including how long we keep data and
          who helps us run the service — will be published, after independent review, before accounts open.
        </p>

        <ul className="mt-12 space-y-4">
          {commitments.map((item) => (
            <li key={item.title} className="rounded-xl border-2 border-ink/15 bg-surface p-6">
              <h2 className="text-xl font-bold text-ink">{item.title}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 rounded-lg bg-muted px-5 py-4 text-ink">
          Right now LITTLE FOUNDERS is a preview. We don’t use tracking or advertising cookies. The only cookies we set
          keep parents signed in. Parent accounts store an email address; child profiles must use fictional details
          until our review is complete.
        </p>
      </Container>
    </article>
  );
}
