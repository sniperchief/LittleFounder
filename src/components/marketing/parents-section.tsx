import { EyeOff, LayoutDashboard, ShieldCheck, Smartphone, Trash2, UserRound } from "lucide-react";

import { Container } from "@/components/layout/container";

const features = [
  {
    icon: ShieldCheck,
    title: "You own the account",
    body: "Parents create the account and their children’s profiles. Children never need their own email or password.",
  },
  {
    icon: Smartphone,
    title: "Child Mode on your device",
    body: "Hand over your device in Child Mode. A parent PIN keeps your settings and dashboard separate.",
  },
  {
    icon: LayoutDashboard,
    title: "See progress and projects",
    body: "The Parent Dashboard shows lessons completed, ideas created and pitches practised.",
  },
  {
    icon: EyeOff,
    title: "Private by default",
    body: "Your child’s work is visible only to you. No chat, no public profiles, no ads.",
  },
  {
    icon: UserRound,
    title: "Only what’s needed",
    body: "We ask for a nickname and an age range — never photos, school names or birthdays.",
  },
  {
    icon: Trash2,
    title: "Delete any time",
    body: "Remove your child’s profile whenever you choose — it’s permanently deleted after 30 days.",
  },
];

const skills = [
  "Noticing problems and thinking creatively about solutions",
  "Everyday maths with prices, costs and profit",
  "Thinking about other people’s needs",
  "Explaining an idea clearly and answering questions",
];

export function ParentsSection() {
  return (
    <section id="parents" aria-labelledby="parents-title" className="bg-ink py-16 text-white sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-sun">For parents</p>
            <h2 id="parents-title" className="text-3xl font-extrabold sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              You stay in charge, every step of the way
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/80">
              LITTLE FOUNDERS is designed for families: parents set everything up, children learn in a safe space,
              and you can see what they’re working on.
            </p>

            <h3 className="mt-10 text-xl font-bold">What children practise</h3>
            <ul className="mt-4 space-y-3">
              {skills.map((skill) => (
                <li key={skill} className="flex gap-3 text-white/85">
                  <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-sun" />
                  {skill}
                </li>
              ))}
            </ul>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border-2 border-white/15 bg-white/[0.06] p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-sun text-ink">
                  <Icon className="size-5" aria-hidden="true" strokeWidth={2.4} />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-white/75">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-12 rounded-lg border-2 border-sun/60 px-5 py-4 text-white/90">
          <strong className="text-sun">Early preview:</strong> parent accounts are open for testing while we complete an
          independent privacy and safety review. Until then, please use fictional nicknames for child profiles.
        </p>
      </Container>
    </section>
  );
}
