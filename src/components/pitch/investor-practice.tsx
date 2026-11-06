"use client";

import { ArrowRight, MessageCircle, ShieldAlert, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { answerQuestionAction, type AnswerResult } from "@/app/play/pitch/actions";
import { InvestorAvatar } from "@/components/illustrations/investor-avatar";
import { investorKey, PretendInvestorLabel } from "@/components/pitch/pitch-visuals";
import { Button } from "@/components/ui/button";
import { answerLevel, earnsOwnWordsBonus, ownWordsRule, pitchLimits, pitchPrivacyIssue, pitchSections } from "@/content/pitch-studio";
import type { Persona, PitchSnapshot, PracticeQuestion } from "@/lib/data/pitch";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string;
  deckId: string;
  persona: Persona;
  questions: PracticeQuestion[];
  answered: number;
  deck: PitchSnapshot;
};

type Feedback = Extract<AnswerResult, { status: "ok" }>;

export function InvestorPractice({ sessionId, deckId, persona, questions, answered, deck }: Props) {
  const router = useRouter();
  const uid = useId();
  const [index, setIndex] = useState(Math.min(answered, questions.length - 1));
  const [started, setStarted] = useState(answered > 0);
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const question = questions[index];
  const section = pitchSections.find((s) => s.key === question.section);
  const yourText = deck.sections[question.section]?.main;
  const nudge = pitchPrivacyIssue(note);
  const bonusReady = earnsOwnWordsBonus(note);
  const avatar = investorKey(persona.key);

  function submit() {
    if (!choice || nudge) return;
    setError(null);
    startTransition(async () => {
      const res = await answerQuestionAction(sessionId, question.id, choice, note);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setFeedback(res);
    });
  }

  function next() {
    if (feedback?.completed) {
      const badges = feedback.badges.map((b) => b.key).join(",");
      router.push(`/play/pitch/${deckId}/investor/${sessionId}?done=1${badges ? `&badges=${badges}` : ""}`);
      router.refresh();
      return;
    }
    setFeedback(null);
    setChoice(null);
    setNote("");
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!started) {
    return (
      <section aria-labelledby={`${uid}-hello`} className="rounded-3xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
          <InvestorAvatar investor={avatar} className="size-24 shrink-0" />
          <div>
            <PretendInvestorLabel />
            <h2 id={`${uid}-hello`} className="mt-2 text-3xl font-extrabold text-ink">
              Meet {persona.name}
            </h2>
            <p className="mt-2 rounded-2xl rounded-tl-none bg-sky-soft px-4 py-3 text-lg text-ink">{persona.intro}</p>
            <p className="mt-3 text-ink/80">
              {persona.name.split(" ")[0]} will ask you {questions.length} questions about your pitch. For each one, pick the answer that
              fits best, then add your own words if you like ({ownWordsRule.minWords}+ words earns a bonus point).
            </p>
          </div>
        </div>
        <div className="mt-6 text-center sm:text-right">
          <Button size="lg" onClick={() => setStarted(true)}>
            I&apos;m ready <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${uid}-q`} className="rounded-3xl border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker-lg)] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral-ink">
          Question {index + 1} of {questions.length}
          {section ? ` · ${section.title}` : ""}
        </p>
        <PretendInvestorLabel />
      </div>
      <div
        role="progressbar"
        aria-label="Practice progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={index + (feedback ? 1 : 0)}
        className="mt-3 h-2.5 overflow-hidden rounded-full border border-ink/15 bg-muted"
      >
        <div className="h-full rounded-full bg-mint" style={{ width: `${((index + (feedback ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="mt-6 flex gap-4">
        <InvestorAvatar investor={avatar} className="size-16 shrink-0 sm:size-20" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted-foreground">{persona.name} asks:</p>
          <h2 id={`${uid}-q`} className="mt-1 rounded-2xl rounded-tl-none bg-sky-soft px-4 py-3 text-xl font-bold text-ink sm:text-2xl">
            {question.prompt}
          </h2>
          {question.hint ? <p className="mt-2 text-sm text-ink/75">Hint: {question.hint}</p> : null}
        </div>
      </div>

      {yourText ? (
        <p className="mt-5 rounded-xl border-2 border-dashed border-ink/25 px-4 py-3 text-ink/85 [overflow-wrap:anywhere]">
          <span className="font-bold text-ink">Your pitch said: </span>
          {yourText}
        </p>
      ) : null}

      {feedback ? (
        <div role="status" className="mt-6 space-y-3 rounded-2xl border-2 border-ink bg-muted p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-3 py-1 text-sm font-bold uppercase tracking-[0.08em] text-ink", answerLevel(feedback.score).tone)}>
              {answerLevel(feedback.score).label}
            </span>
            {feedback.bonus ? (
              <span className="rounded-full bg-grape-soft px-3 py-1 text-sm font-bold uppercase tracking-[0.08em] text-ink">+1 own words</span>
            ) : null}
          </div>
          <p className="text-lg text-ink">{feedback.feedback}</p>
          {feedback.stronger ? (
            <p className="text-ink/85">
              <span className="font-semibold">A stronger answer:</span> {feedback.stronger}
            </p>
          ) : null}
          <p className="text-sm text-ink/80">
            {feedback.bonus
              ? "Great job explaining in your own words — that earned a bonus point."
              : `Tip: add your own words next time (${ownWordsRule.minWords} or more words) for a bonus point.`}
          </p>
          <div className="pt-1 text-right">
            <Button size="lg" onClick={next}>
              {feedback.completed ? "See my practice feedback" : "Next question"} <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="text-lg font-bold text-ink">Pick the answer that fits best</legend>
            <div role="radiogroup" aria-label="Answers" className="mt-3 grid gap-2">
              {question.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={choice === o.id}
                  onClick={() => setChoice(o.id)}
                  className={cn(
                    "rounded-2xl border-2 px-4 py-3 text-left font-semibold text-ink transition-colors",
                    choice === o.id ? "border-ink bg-sun-soft shadow-[var(--shadow-sticker)]" : "border-border bg-surface hover:border-ink/60",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5">
            <label htmlFor={`${uid}-note`} className="flex items-center gap-2 font-bold text-ink">
              <MessageCircle className="size-5" aria-hidden="true" /> Now say it in your own words{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id={`${uid}-note`}
              rows={3}
              value={note}
              maxLength={pitchLimits.note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How would you answer, talking about your own idea?"
              aria-describedby={`${uid}-note-help`}
              aria-invalid={Boolean(nudge) || undefined}
              className="mt-1.5 w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink/40 focus-visible:outline-3 focus-visible:outline-ring"
            />
            <div id={`${uid}-note-help`} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
              <span className={cn("inline-flex items-center gap-1", bonusReady && "text-ink")}>
                <Sparkles className="size-3.5" aria-hidden="true" />
                {bonusReady ? "Bonus point ready!" : `${ownWordsRule.minWords}+ words earns a bonus point`}
              </span>
              <span>
                {note.length}/{pitchLimits.note}
              </span>
            </div>
            {nudge ? (
              <p role="alert" className="mt-1 flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-sm font-semibold text-ink">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {nudge}
              </p>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">
              {error}
            </p>
          ) : null}

          <div className="mt-6 text-right">
            <Button size="lg" disabled={!choice || Boolean(nudge) || pending} onClick={submit}>
              {pending ? "Checking…" : "Give my answer"} <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
