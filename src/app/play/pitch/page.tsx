import type { Metadata } from "next";
import { ArrowRight, FlaskConical, Mic, Presentation, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { startPitchAction } from "@/app/play/pitch/actions";
import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaIcon, IdeaStatusChip } from "@/components/ideas/idea-visuals";
import { InvestorAvatar } from "@/components/illustrations/investor-avatar";
import { formatDate, investorKey, PitchStateChip } from "@/components/pitch/pitch-visuals";
import { SubmitButton } from "@/components/ui/form-controls";
import { pitchSections } from "@/content/pitch-studio";
import { requireChildMode } from "@/lib/auth/session";
import { listIdeas } from "@/lib/data/ideas";
import { listPersonas, listPitches, pitchState } from "@/lib/data/pitch";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pitch Studio" };

const errors: Record<string, string> = {
  idea_required: "Pick one of your Idea Lab ideas to start a pitch.",
  limit_reached: "You already have lots of pitches! Keep improving one of those.",
  rate_limited: "That's a lot of new pitches! Take a short break and come back.",
  personal_info: "Your idea has some personal details in it, so we left those parts out.",
};

export default function PitchStudioPage(props: PageProps<"/play/pitch">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <PitchStudio {...props} />
    </Suspense>
  );
}

async function PitchStudio({ searchParams }: PageProps<"/play/pitch">) {
  const [{ child, supabase }, query] = await Promise.all([requireChildMode(), searchParams]);
  const [pitches, ideas, personas] = await Promise.all([listPitches(supabase, child.id), listIdeas(supabase, child.id), listPersonas(supabase)]);
  const pitchFor = new Map(pitches.filter((p) => p.projectId).map((p) => [p.projectId as string, p]));
  const error = typeof query.error === "string" ? (errors[query.error] ?? "Something went wrong. Please try again.") : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play">Founder HQ</BackLink>

      <header className="mt-5 rounded-3xl border-2 border-ink bg-sky-soft p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl border-2 border-ink bg-surface">
            <Presentation className="size-10 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold text-ink">Pitch Studio</h1>
            <p className="mt-1 text-lg text-ink/85">
              A <strong>pitch</strong> is a short talk that explains your business idea, so other people understand it and get excited about it.
              Founders pitch to customers, teammates and investors.
            </p>
          </div>
        </div>
        <ol className="mt-5 grid gap-2 text-sm text-ink/85 sm:grid-cols-3">
          <li className="rounded-xl bg-surface px-3 py-2">
            <strong className="text-ink">1. Build:</strong> answer five guided questions about your idea
          </li>
          <li className="rounded-xl bg-surface px-3 py-2">
            <strong className="text-ink">2. Present:</strong> turn your answers into a six-slide deck
          </li>
          <li className="rounded-xl bg-surface px-3 py-2">
            <strong className="text-ink">3. Practise:</strong> answer questions from friendly pretend investors
          </li>
        </ol>
        <p className="mt-4 flex items-start gap-2 text-sm text-ink/80">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Your pitch stays private to you and your grown-up. Never add your name, address, phone number, email or links.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">
          {error}
        </p>
      ) : null}

      <section aria-labelledby="parts" className="mt-8">
        <h2 id="parts" className="text-2xl font-bold text-ink">
          The five parts of a pitch
        </h2>
        <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {pitchSections.map((s, i) => (
            <li key={s.key} className={cn("rounded-2xl border-2 border-ink p-4", s.tone, i === 4 && "col-span-2 sm:col-span-1")}>
              <p className="font-display text-sm font-bold text-ink/60">Part {i + 1}</p>
              <p className="font-display text-lg font-extrabold leading-tight text-ink">{s.title}</p>
              <p className="mt-1 text-sm text-ink/80">{s.question}</p>
              {!s.required ? <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-ink/60">Optional</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="start" className="mt-10">
        <h2 id="start" className="text-2xl font-bold text-ink">
          Start a pitch from your idea
        </h2>
        {ideas.length === 0 ? (
          <div className="mt-4 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-ink/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-coral-soft">
                <FlaskConical className="size-7 text-ink" aria-hidden="true" />
              </span>
              <p className="text-ink/85">Every pitch starts with an idea. Save one in the Idea Lab first, then come back to pitch it!</p>
            </div>
            <Link href="/play/ideas" className="inline-flex shrink-0 items-center gap-2 font-bold text-ink underline underline-offset-4">
              Go to the Idea Lab <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {ideas.map((idea) => {
              const existing = pitchFor.get(idea.id);
              return (
                <li key={idea.id} className="flex items-center gap-3 rounded-2xl border-2 border-ink/30 bg-surface p-3 pl-4">
                  <IdeaIcon name={idea.icon_key} className="size-6 shrink-0 text-ink" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink [overflow-wrap:anywhere]">{idea.name}</span>
                    <IdeaStatusChip status={idea.status} />
                  </span>
                  {existing ? (
                    <Link
                      href={`/play/pitch/${existing.id}`}
                      className="shrink-0 rounded-full border-2 border-ink bg-surface px-4 py-1.5 text-sm font-semibold text-ink hover:bg-muted"
                    >
                      Open pitch<span className="sr-only"> for {idea.name}</span>
                    </Link>
                  ) : (
                    <form action={startPitchAction} className="shrink-0">
                      <input type="hidden" name="projectId" value={idea.id} />
                      <SubmitButton size="sm" pendingLabel="Starting…">
                        Start pitch<span className="sr-only"> for {idea.name}</span>
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="mine" className="mt-10">
        <h2 id="mine" className="text-2xl font-bold text-ink">
          My pitches
        </h2>
        {pitches.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-ink/25 p-6 text-center text-ink/75">
            No pitches yet. Pick an idea above to start your first one!
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {pitches.map((p) => {
              const state = pitchState(p);
              return (
                <li key={p.id}>
                  <Link
                    href={state === "draft" ? `/play/pitch/${p.id}/edit?step=${p.builderStep}` : `/play/pitch/${p.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border-2 border-ink/30 bg-surface px-5 py-3 hover:border-ink"
                  >
                    <IdeaIcon name={p.current.icon_key} className="size-5 shrink-0 text-ink" aria-hidden="true" />
                    <span className="min-w-0 flex-1 font-bold text-ink [overflow-wrap:anywhere]">{p.current.title}</span>
                    <PitchStateChip state={state} version={p.versionCount} />
                    <span className="text-sm text-ink/80">
                      {state === "draft"
                        ? `Continue at step ${p.builderStep}`
                        : p.practicesCompleted > 0
                          ? `${p.practicesCompleted} practice${p.practicesCompleted === 1 ? "" : "s"} · best ${p.bestScore}/100`
                          : "Ready for the Investor Room"}
                    </span>
                    <span className="text-sm text-muted-foreground">{formatDate(p.updatedAt)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="investors" className="mt-10 rounded-3xl border-2 border-ink bg-grape-soft p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <Mic className="size-7 text-ink" aria-hidden="true" />
          <h2 id="investors" className="text-2xl font-bold text-ink">
            The Investor Room
          </h2>
        </div>
        <p className="mt-2 text-ink/85">
          Once your pitch is finished, practise answering questions from a friendly pretend investor. You&apos;ll get practice feedback
          straight away. They&apos;re made-up characters: no real investors, and no real money.
        </p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {personas.map((p) => (
            <li key={p.key} className="rounded-2xl border-2 border-ink bg-surface p-4 text-center">
              <InvestorAvatar investor={investorKey(p.key)} className="mx-auto size-16" />
              <p className="mt-2 font-bold text-ink">{p.name}</p>
              <p className="text-sm text-ink/75">{p.focus}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
