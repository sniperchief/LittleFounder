import { Info } from "lucide-react";

import { InvestorAvatar, type InvestorKey } from "@/components/illustrations/investor-avatar";
import { Section, SectionHeader } from "@/components/layout/container";

const pitchParts = [
  { title: "Problem", hint: "What’s wrong?", tone: "bg-coral-soft" },
  { title: "Solution", hint: "How will you fix it?", tone: "bg-sun-soft" },
  { title: "Customer", hint: "Who needs it?", tone: "bg-sky-soft" },
  { title: "Business model", hint: "How does it make money?", tone: "bg-mint-soft" },
  { title: "The ask", hint: "What help do you need?", tone: "bg-grape-soft" },
];

const investors: { key: InvestorKey; name: string; focus: string }[] = [
  { key: "penny", name: "Penny the Planner", focus: "Asks about costs, prices and profit." },
  { key: "captain", name: "Captain Customer", focus: "Wants to know who will buy, and why." },
  { key: "ivy", name: "Inventor Ivy", focus: "Loves creative solutions and clever twists." },
  { key: "sam", name: "Steady Sam", focus: "Thinks carefully about risks and next steps." },
];

export function PitchSection() {
  return (
    <Section id="pitch" aria-labelledby="pitch-title">
      <SectionHeader
        id="pitch-title"
        eyebrow="Pitch your ideas"
        title="Practise the big moment"
        description="In Pitch Studio, children build a simple five-slide pitch. Then they step into the Investor Room to present it and answer questions."
      />

      <div className="mt-14">
        <h3 className="text-center text-xl font-bold text-ink">Pitch Studio: five parts of a great pitch</h3>
        <ol className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pitchParts.map((part, i) => (
            <li
              key={part.title}
              className={`flex aspect-[4/3] flex-col justify-between rounded-lg border-2 border-ink p-4 ${part.tone} ${
                i === 4 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <span className="font-display text-sm font-bold text-ink/60">Slide {i + 1}</span>
              <span>
                <span className="block font-display text-lg font-extrabold leading-tight text-ink">{part.title}</span>
                <span className="mt-0.5 block text-sm text-ink/75">{part.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-16">
        <h3 className="text-center text-xl font-bold text-ink">The Investor Room: meet the panel</h3>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {investors.map((investor) => (
            <li key={investor.key} className="rounded-xl border-2 border-ink bg-surface p-6 text-center">
              <InvestorAvatar investor={investor.key} className="mx-auto size-20" />
              <p className="mt-4 font-display text-lg font-bold text-ink">{investor.name}</p>
              <p className="mt-1 text-muted-foreground">{investor.focus}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-lg border-2 border-ink/15 bg-surface px-5 py-4 text-ink">
          <Info className="mt-0.5 size-5 shrink-0 text-sky" aria-hidden="true" />
          <span>
            The investors are friendly made-up characters with set questions — not real people. Feedback follows
            clear scoring rules, so it’s consistent and always encouraging. No real money or investment is involved.
          </span>
        </p>
      </div>
    </Section>
  );
}
