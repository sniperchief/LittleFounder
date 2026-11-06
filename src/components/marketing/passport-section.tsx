import { Award, Lock, Mic, Search, Tags, Users } from "lucide-react";

import { LogoMark } from "@/components/brand/logo";
import { Section, SectionHeader } from "@/components/layout/container";
import { cn } from "@/lib/utils";

const badges = [
  { icon: Search, label: "Problem Spotter", tone: "bg-coral-soft", earned: true },
  { icon: Users, label: "Customer Detective", tone: "bg-sky-soft", earned: true },
  { icon: Tags, label: "Price Pro", tone: "bg-mint-soft", earned: true },
  { icon: Mic, label: "Pitch Ready", tone: "bg-grape-soft", earned: false },
];

const stats = [
  { value: "4 / 6", label: "Modules" },
  { value: "2", label: "Ideas" },
  { value: "3", label: "Pitches" },
];

export function PassportSection() {
  return (
    <Section id="passport" aria-labelledby="passport-title" className="bg-sun-soft/70">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader
            id="passport-title"
            align="left"
            eyebrow="Founder Passport"
            title="Every step, celebrated"
            description="Each lesson, idea and pitch adds to a child’s Founder Passport. Badges mark milestones along the way, and certificates celebrate finishing bigger challenges — like completing all six Academy modules."
          />
          <p className="mt-6 text-muted-foreground">
            Certificates recognise progress within LITTLE FOUNDERS. They are not formal qualifications.
          </p>
        </div>

        {/* Example passport with fictional data */}
        <figure className="mx-auto w-full max-w-md">
          <div aria-hidden="true" className="rounded-xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)]">
            <div className="flex items-center justify-between border-b-2 border-dashed border-ink/20 pb-4">
              <div className="flex items-center gap-3">
                <LogoMark className="size-10" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Founder Passport</p>
                  <p className="font-display text-xl font-extrabold text-ink">Founder Zed</p>
                </div>
              </div>
              <Award className="size-8 text-coral" />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col-reverse rounded-md bg-muted px-3 py-2 text-center">
                  <dt className="text-xs font-semibold text-muted-foreground">{stat.label}</dt>
                  <dd className="font-display text-xl font-extrabold text-ink">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 grid grid-cols-4 gap-2">
              {badges.map(({ icon: Icon, label, tone, earned }) => (
                <li key={label} className="text-center">
                  <div
                    className={cn(
                      "mx-auto flex size-14 items-center justify-center rounded-full border-2",
                      earned ? cn("border-ink", tone) : "border-dashed border-ink/30 bg-muted",
                    )}
                  >
                    {earned ? <Icon className="size-6 text-ink" /> : <Lock className="size-5 text-ink/40" />}
                  </div>
                  <p className={cn("mt-1.5 text-[0.7rem] font-semibold leading-tight", earned ? "text-ink" : "text-muted-foreground")}>
                    {label}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-lg border-2 border-ink bg-sun-soft px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">Next certificate</p>
              <p className="font-display font-bold text-ink">Founder Academy Graduate</p>
              <div className="mt-2 h-2.5 rounded-full bg-surface">
                <div className="h-full w-2/3 rounded-full bg-coral" />
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center text-sm text-muted-foreground">
            Example passport for a fictional founder.
          </figcaption>
        </figure>
      </div>
    </Section>
  );
}
