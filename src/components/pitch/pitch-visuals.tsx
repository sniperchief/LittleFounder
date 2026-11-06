import { Check, Info, Lightbulb, MessageCircle, Sparkles, Star } from "lucide-react";

import { IdeaIcon } from "@/components/ideas/idea-visuals";
import { InvestorAvatar, type InvestorKey } from "@/components/illustrations/investor-avatar";
import {
  answerLevel,
  bandOf,
  ownWordsTip,
  pitchSections,
  pitchThemes,
  rubricCriteria,
} from "@/content/pitch-studio";
import type { Practice, PitchSnapshot } from "@/lib/data/pitch";
import { cn } from "@/lib/utils";

// Pitch deck slides and Investor Room results. The deck is drawn only from saved pitch
// content; practice results only from stored, server-scored records.

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export const investorKey = (key: string): InvestorKey => (["penny", "captain", "ivy", "sam"].includes(key) ? (key as InvestorKey) : "penny");

export function PretendInvestorLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border-2 border-ink bg-surface px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink", className)}>
      <Sparkles className="size-3.5" aria-hidden="true" /> Pretend investor · practice only
    </span>
  );
}

export function PitchStateChip({ state, version }: { state: "draft" | "completed" | "revising"; version?: number | null }) {
  const map = {
    draft: { label: "Draft", className: "bg-sun-soft" },
    completed: { label: version ? `Completed · v${version}` : "Completed", className: "bg-mint" },
    revising: { label: version ? `Revising · v${version} saved` : "Revising", className: "bg-sky-soft" },
  }[state];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink", map.className)}>
      {state === "completed" ? <Check className="size-3.5" aria-hidden="true" /> : null}
      {map.label}
    </span>
  );
}

const themeOf = (key: string) => pitchThemes.find((t) => t.key === key) ?? pitchThemes[0];

/** One slide. index 0 is the title slide, 1–5 are the pitch sections. */
export function Slide({ deck, index, present = false }: { deck: PitchSnapshot; index: number; present?: boolean }) {
  const theme = themeOf(deck.theme_key);
  const frame = cn(
    "flex aspect-[16/10] w-full flex-col overflow-hidden rounded-2xl border-2 border-ink",
    present ? "p-[5%] shadow-[var(--shadow-sticker-lg)]" : "p-4 sm:p-5",
    theme.slide,
  );

  if (index === 0) {
    return (
      <div className={cn(frame, "items-center justify-center text-center")}>
        <span className={cn("flex items-center justify-center rounded-3xl border-2 border-ink", theme.accent, present ? "size-[18%] min-h-12 min-w-12" : "size-12")}>
          <IdeaIcon name={deck.icon_key} className={cn("text-ink", present ? "size-1/2" : "size-6")} aria-hidden="true" />
        </span>
        <p className={cn("mt-[3%] font-display font-extrabold leading-tight text-ink [overflow-wrap:anywhere]", present ? "text-[clamp(1.5rem,5vw,4rem)]" : "text-xl sm:text-2xl")}>
          {deck.title}
        </p>
        {deck.tagline ? (
          <p className={cn("mt-[2%] max-w-[85%] text-ink/85 [overflow-wrap:anywhere]", present ? "text-[clamp(1rem,2.2vw,1.75rem)]" : "line-clamp-3 text-sm")}>
            {deck.tagline}
          </p>
        ) : null}
        <p className={cn("mt-auto font-bold uppercase tracking-[0.14em] text-ink/60", present ? "text-[clamp(0.65rem,1.1vw,0.9rem)]" : "text-[0.65rem]")}>
          Made in Pitch Studio · Little Founders
        </p>
      </div>
    );
  }

  const section = pitchSections[index - 1];
  const text = deck.sections[section.key];
  return (
    <div className={frame}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-display font-extrabold text-ink",
            theme.accent,
            present ? "size-[clamp(1.75rem,3.5vw,3rem)] text-[clamp(0.9rem,1.6vw,1.4rem)]" : "size-7 text-sm",
          )}
        >
          {index}
        </span>
        <p className={cn("font-bold uppercase tracking-[0.12em] text-ink/70", present ? "text-[clamp(0.7rem,1.3vw,1.05rem)]" : "text-xs")}>
          {section.title}
        </p>
      </div>
      <p className={cn("mt-[2%] font-display font-extrabold leading-tight text-ink", present ? "text-[clamp(1.1rem,2.8vw,2.4rem)]" : "text-base sm:text-lg")}>
        {section.question}
      </p>
      {text.main ? (
        <p className={cn("mt-[2%] text-ink [overflow-wrap:anywhere]", present ? "text-[clamp(0.95rem,2vw,1.7rem)]" : "line-clamp-4 text-sm")}>{text.main}</p>
      ) : (
        <p className={cn("mt-[2%] italic text-ink/50", present ? "text-[clamp(0.95rem,2vw,1.7rem)]" : "text-sm")}>Not added yet</p>
      )}
      {text.extra ? (
        <div className={cn("mt-auto rounded-xl bg-surface/80", present ? "p-[2.5%]" : "p-2")}>
          <p className={cn("font-bold text-ink/70", present ? "text-[clamp(0.7rem,1.2vw,1rem)]" : "text-[0.7rem]")}>{section.extraLabel}</p>
          <p className={cn("text-ink [overflow-wrap:anywhere]", present ? "text-[clamp(0.85rem,1.6vw,1.35rem)]" : "line-clamp-2 text-xs")}>{text.extra}</p>
        </div>
      ) : null}
    </div>
  );
}

export function DeckGrid({ deck }: { deck: PitchSnapshot }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pitch deck slides">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <li key={i}>
          <span className="sr-only">Slide {i + 1}</span>
          <Slide deck={deck} index={i} />
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Investor Room results
// ---------------------------------------------------------------------------

function ScoreDots({ value, max = 4, label }: { value: number; max?: number; label: string }) {
  return (
    <span role="img" aria-label={`${label}: ${value} out of ${max}`} className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={cn("size-5", i < value ? "fill-sun text-ink" : "text-ink/20")} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Practice score, rubric breakdown, strengths, suggestions and every answer's feedback. */
export function PracticeResultView({ practice, showAnswers = true }: { practice: Practice; showAnswers?: boolean }) {
  const band = bandOf(practice.band);
  const scored = rubricCriteria.map((c) => ({ ...c, value: practice.subScores[c.section] ?? 0 }));
  const strengths = scored.filter((c) => c.value >= 3);
  const tips = practice.tips
    .map((key) => (key === "own-words" ? ownWordsTip : rubricCriteria.find((c) => c.section === key)?.tip))
    .filter((t): t is string => Boolean(t))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section aria-labelledby={`score-${practice.id}`} className="rounded-3xl border-2 border-ink bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <InvestorAvatar investor={investorKey(practice.personaKey)} className="size-20 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Practice feedback from {practice.personaName}</p>
            <h2 id={`score-${practice.id}`} className="mt-1 text-3xl font-extrabold text-ink">
              {band.label}
            </h2>
            <p className="mt-1 text-ink/85">{band.message}</p>
          </div>
          <div className="shrink-0 rounded-2xl border-2 border-ink bg-sun-soft px-5 py-3 text-center">
            <p className="font-display text-4xl font-extrabold text-ink tabular-nums">{practice.totalScore ?? 0}</p>
            <p className="text-sm font-semibold text-ink/75">practice score / 100</p>
            <p className="text-xs text-ink/65">{practice.points ?? 0} of 20 rubric points</p>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-ink/80">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This is practice feedback from a pretend investor, worked out with fixed rules. No real investor has seen your pitch, and nobody is
          offering real money.
        </p>
      </section>

      <section aria-labelledby={`rubric-${practice.id}`} className="rounded-3xl border-2 border-ink bg-surface p-5 sm:p-6">
        <h3 id={`rubric-${practice.id}`} className="text-xl font-bold text-ink">
          Rubric breakdown
        </h3>
        <ul className="mt-4 divide-y divide-border">
          {scored.map((c) => (
            <li key={c.section} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
              <span className="font-semibold text-ink">{c.label}</span>
              <ScoreDots value={c.value} label={c.label} />
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section aria-labelledby={`well-${practice.id}`} className="rounded-3xl border-2 border-ink bg-mint-soft p-5 sm:p-6">
          <h3 id={`well-${practice.id}`} className="flex items-center gap-2 text-xl font-bold text-ink">
            <Sparkles className="size-5" aria-hidden="true" /> What you explained well
          </h3>
          <ul className="mt-3 space-y-2 text-ink/90">
            {(strengths.length ? strengths.map((c) => c.strength) : ["You finished a whole practice. Answering investor questions takes courage!"]).map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby={`tips-${practice.id}`} className="rounded-3xl border-2 border-ink bg-sun-soft p-5 sm:p-6">
          <h3 id={`tips-${practice.id}`} className="flex items-center gap-2 text-xl font-bold text-ink">
            <Lightbulb className="size-5" aria-hidden="true" /> Ideas to improve
          </h3>
          <ul className="mt-3 space-y-2 text-ink/90">
            {(tips.length ? tips : ["Brilliant — try a different pretend investor for new questions!"]).map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true">→</span> {t}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showAnswers ? (
        <section aria-labelledby={`answers-${practice.id}`}>
          <h3 id={`answers-${practice.id}`} className="text-xl font-bold text-ink">
            Your answers
          </h3>
          <ol className="mt-3 space-y-3">
            {practice.answers.map((a, i) => <AnswerFeedback key={a.questionId} n={i + 1} answer={a} />)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function AnswerFeedback({ n, answer }: { n: number; answer: Practice["answers"][number] }) {
  const level = answerLevel(answer.score);
  const section = pitchSections.find((s) => s.key === answer.review.section);
  return (
    <li className="rounded-2xl border-2 border-ink/25 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-muted-foreground">
          Question {n}
          {section ? ` · ${section.title}` : ""}
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink", level.tone)}>{level.label}</span>
        {answer.bonus ? (
          <span className="rounded-full bg-grape-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">+1 own words</span>
        ) : null}
      </div>
      <p className="mt-1.5 font-bold text-ink">{answer.review.prompt}</p>
      <p className="mt-1 text-ink/85">
        <span className="font-semibold">You chose:</span> {answer.review.answer}
      </p>
      {answer.note ? (
        <p className="mt-1 flex gap-2 text-ink/85 [overflow-wrap:anywhere]">
          <MessageCircle className="mt-1 size-4 shrink-0" aria-hidden="true" /> “{answer.note}”
        </p>
      ) : null}
      <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-ink">{answer.review.feedback}</p>
      {answer.review.stronger ? (
        <p className="mt-2 text-sm text-ink/80">
          <span className="font-semibold">A stronger answer:</span> {answer.review.stronger}
        </p>
      ) : null}
    </li>
  );
}
