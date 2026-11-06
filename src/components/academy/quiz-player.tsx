"use client";

import { ArrowRight, CheckCircle2, RotateCcw, Trophy, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { submitQuizAction, type EarnedBadge } from "@/app/play/academy/actions";
import { BadgeList } from "@/components/academy/badge-list";
import { Button, buttonVariants } from "@/components/ui/button";
import type { QuizQuestionPublic, QuizResult } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

type Props = {
  moduleKey: string;
  questions: QuizQuestionPublic[];
  review: QuizResult | null;
  passMark: number;
  afterPass: { href: string; label: string };
  moduleHref: string;
};

export function QuizPlayer({ moduleKey, questions, review, passMark, afterPass, moduleHref }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(review);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answered = Object.keys(answers).length;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitQuizAction(moduleKey, answers);
      if (res.status === "ok") {
        setResult(res.result);
        setBadges(res.badges);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.message);
      }
    });
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setBadges([]);
  }

  if (result) {
    const byId = new Map(result.results.map((r) => [r.question_id, r]));
    return (
      <div className="space-y-6">
        <section
          aria-live="polite"
          className={cn(
            "rounded-2xl border-2 border-ink p-6 text-center shadow-[var(--shadow-sticker-lg)] sm:p-8",
            result.passed ? "bg-mint-soft" : "bg-sun-soft",
          )}
        >
          <Trophy className="mx-auto size-10 text-ink" aria-hidden="true" />
          <p className="mt-2 font-display text-5xl font-extrabold text-ink">{result.score}%</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {result.correct} of {result.total} correct
          </p>
          <p className="mt-2 text-ink/85">
            {result.passed
              ? result.score === 100
                ? "Perfect score! You really know this module."
                : "You passed! Great founder thinking."
              : `You need ${passMark}% to pass. Read the explanations below, then have another go — you've got this!`}
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            {result.passed ? (
              <Link href={afterPass.href} className={buttonVariants({ size: "lg" })}>
                {afterPass.label} <ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
            <Button variant={result.passed ? "secondary" : "primary"} size="lg" onClick={retry}>
              <RotateCcw aria-hidden="true" /> {result.passed ? "Take it again" : "Try again"}
            </Button>
          </div>
        </section>

        {badges.length > 0 ? <BadgeList badges={badges} heading="New badge unlocked!" /> : null}

        <h2 className="text-2xl font-bold text-ink">Your answers</h2>
        <ol className="space-y-4">
          {questions.map((q, n) => {
            const r = byId.get(q.id);
            return (
              <li key={q.id} className="rounded-2xl border-2 border-ink bg-surface p-5">
                <p className="flex items-start gap-2 font-bold text-ink">
                  {r?.is_correct ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ink" aria-label="Correct" />
                  ) : (
                    <XCircle className="mt-0.5 size-5 shrink-0 text-coral-ink" aria-label="Incorrect" />
                  )}
                  <span>
                    {n + 1}. {q.prompt}
                  </span>
                </p>
                <ul className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const isCorrect = r?.correct_option_id === o.id;
                    const isChosen = r?.chosen_option_id === o.id;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "rounded-lg border-2 px-3 py-2 text-ink",
                          isCorrect ? "border-mint bg-mint-soft font-semibold" : isChosen ? "border-coral bg-coral-soft" : "border-border",
                        )}
                      >
                        {o.label}
                        {isChosen ? <span className="ml-2 text-sm font-bold">(your answer)</span> : null}
                        {isCorrect && !isChosen ? <span className="ml-2 text-sm font-bold">(correct answer)</span> : null}
                      </li>
                    );
                  })}
                </ul>
                {r?.feedback ? <p className="mt-3 text-ink/85">{r.feedback}</p> : null}
                {r?.explanation ? (
                  <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-ink/85">
                    <span className="font-bold text-ink">Why: </span>
                    {r.explanation}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        <Link href={moduleHref} className={buttonVariants({ variant: "secondary" })}>
          Back to the module
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (answered === questions.length && !pending) submit();
      }}
      className="space-y-5"
    >
      {questions.map((q, n) => (
        <fieldset key={q.id} className="rounded-2xl border-2 border-ink bg-surface p-5">
          <legend className="sr-only">
            Question {n + 1}: {q.prompt}
          </legend>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Question {n + 1} of {questions.length}
          </p>
          <p className="mt-1 text-lg font-bold text-ink" aria-hidden="true">
            {q.prompt}
          </p>
          <div className="mt-3 grid gap-2">
            {q.options.map((o) => (
              <label
                key={o.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                  answers[q.id] === o.id ? "border-ink bg-sun-soft" : "border-border hover:border-ink/50",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={o.id}
                  checked={answers[q.id] === o.id}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                  className="mt-1 size-4 shrink-0 accent-ink"
                />
                <span className="font-semibold">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="sticky bottom-3 flex flex-col items-start gap-3 rounded-2xl border-2 border-ink bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold text-ink" aria-live="polite">
          {answered} of {questions.length} answered
        </p>
        {error ? <p className="font-semibold text-coral-ink">{error}</p> : null}
        <Button type="submit" size="lg" disabled={answered < questions.length || pending}>
          {pending ? "Checking…" : "Submit answers"}
        </Button>
      </div>
    </form>
  );
}
