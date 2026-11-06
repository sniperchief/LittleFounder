"use client";

import { ArrowRight, CheckCircle2, Lightbulb, PartyPopper, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

import {
  completeLessonAction,
  submitActivityAction,
  type ActivityResult,
  type EarnedBadge,
} from "@/app/play/academy/actions";
import { BadgeList } from "@/components/academy/badge-list";
import { Button, buttonVariants } from "@/components/ui/button";
import type { PublicActivity } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

type Props = {
  activity: PublicActivity;
  lessonKey: string;
  solved: boolean;
  completed: boolean;
  next: { href: string; label: string };
};

export function ActivityPlayer({ activity, lessonKey, solved: initiallySolved, completed: initiallyCompleted, next }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [placements, setPlacements] = useState<(0 | 1 | null)[]>(() =>
    activity.kind === "sort" ? activity.items.map(() => null) : [],
  );
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [solved, setSolved] = useState(initiallySolved);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formId = useId();

  const ready =
    activity.kind === "choose"
      ? selected.length > 0
      : activity.kind === "sort"
        ? placements.every((p) => p !== null)
        : value.trim() !== "" && Number.isFinite(Number(value));

  function check() {
    setError(null);
    const response =
      activity.kind === "choose"
        ? { selected }
        : activity.kind === "sort"
          ? { placements: placements as (0 | 1)[] }
          : { value: Number(value) };
    startTransition(async () => {
      const res = await submitActivityAction(activity.key, response);
      setResult(res);
      if (res.status === "ok" && res.correct) setSolved(true);
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await completeLessonAction(lessonKey);
      if (res.status === "ok") {
        setCompleted(true);
        setBadges(res.badges);
      } else {
        setError(res.message);
      }
    });
  }

  const ok = result?.status === "ok" ? result : null;
  // "Pick all that apply": every ticked option is right, but at least one right option is still unticked.
  const partlyRight = Boolean(ok && !ok.correct && activity.kind === "choose" && activity.multi && ok.feedback.length > 0 && ok.feedback.every((f) => f.correct));
  const wrongItems = new Set(ok && !ok.correct ? ok.wrong : []);
  const feedbackFor = (i: number) => ok?.feedback.find((f) => f.option === i);

  return (
    <section aria-labelledby={`${formId}-title`} className="rounded-2xl border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker-lg)] sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-coral-ink">Your challenge</p>
      <h2 id={`${formId}-title`} className="mt-1 text-xl font-bold text-ink sm:text-2xl">
        {activity.prompt}
      </h2>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !pending) check();
        }}
      >
        {activity.kind === "choose" ? (
          <fieldset>
            <legend className="sr-only">{activity.multi ? "Choose all that apply" : "Choose one answer"}</legend>
            {activity.multi ? <p className="mb-3 text-sm font-semibold text-muted-foreground">Pick all that apply.</p> : null}
            <div className="grid gap-3">
              {activity.options.map((label, i) => {
                const fb = feedbackFor(i);
                const checked = selected.includes(i);
                return (
                  <label
                    key={label}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-ink transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                      checked ? "border-ink bg-sun-soft" : "border-border bg-surface hover:border-ink/50",
                      fb && (fb.correct ? "border-mint bg-mint-soft" : "border-coral bg-coral-soft"),
                    )}
                  >
                    <input
                      type={activity.multi ? "checkbox" : "radio"}
                      name={`${formId}-choice`}
                      checked={checked}
                      onChange={() => {
                        setResult(null);
                        setSelected((s) =>
                          activity.multi ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i],
                        );
                      }}
                      className="mt-1 size-4 shrink-0 accent-ink"
                    />
                    <span className="min-w-0">
                      <span className="font-semibold">{label}</span>
                      {fb ? <span className="mt-1 block text-sm text-ink/80">{fb.text}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {activity.kind === "sort" ? (
          <ul className="grid gap-3">
            {activity.items.map((item, i) => (
              <li
                key={item}
                className={cn(
                  "rounded-xl border-2 px-4 py-3",
                  wrongItems.has(i) ? "border-coral bg-coral-soft" : ok?.correct ? "border-mint bg-mint-soft" : "border-border",
                )}
              >
                <fieldset>
                  <legend className="font-semibold text-ink">{item}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activity.buckets.map((bucket, b) => (
                      <label
                        key={bucket}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring",
                          placements[i] === b ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink hover:border-ink/50",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${formId}-item-${i}`}
                          checked={placements[i] === b}
                          onChange={() => {
                            setResult(null);
                            setPlacements((p) => p.map((x, j) => (j === i ? (b as 0 | 1) : x)));
                          }}
                          className="sr-only"
                        />
                        {bucket}
                      </label>
                    ))}
                  </div>
                  {wrongItems.has(i) ? <p className="mt-2 text-sm font-semibold text-coral-ink">Have another think about this one.</p> : null}
                </fieldset>
              </li>
            ))}
          </ul>
        ) : null}

        {activity.kind === "fill" ? (
          <div>
            <label htmlFor={`${formId}-value`} className="text-sm font-semibold text-ink">
              Your answer
            </label>
            <div className="mt-1.5 flex max-w-xs items-center gap-2">
              {activity.prefix ? <span className="font-bold text-ink">{activity.prefix}</span> : null}
              <input
                id={`${formId}-value`}
                type="number"
                inputMode="decimal"
                step="any"
                value={value}
                onChange={(e) => {
                  setResult(null);
                  setValue(e.target.value);
                }}
                className="h-12 w-full rounded-lg border-2 border-ink bg-surface px-3 text-xl font-bold text-ink focus-visible:outline-3 focus-visible:outline-ring"
              />
              {activity.suffix ? <span className="font-bold text-ink">{activity.suffix}</span> : null}
            </div>
          </div>
        ) : null}

        <div aria-live="polite" className="mt-5 space-y-3">
          {result?.status === "error" ? (
            <p className="rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">{result.message}</p>
          ) : null}
          {ok?.correct ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-mint bg-mint-soft px-4 py-3">
              <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">Brilliant — that&apos;s right!</p>
                {ok.explanation ? <p className="text-ink/85">{ok.explanation}</p> : null}
              </div>
            </div>
          ) : null}
          {partlyRight ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-sun bg-sun-soft px-4 py-3">
              <Lightbulb className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">Good pick{ok!.feedback.length > 1 ? "s" : ""} — but there&apos;s more!</p>
                <p className="text-ink/85">More than one answer is right here. Tick every one that fits, then check again.</p>
              </div>
            </div>
          ) : null}
          {ok && !ok.correct && !partlyRight ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-coral bg-coral-soft px-4 py-3">
              <XCircle className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
              <div>
                <p className="font-bold text-ink">Not quite — have another go!</p>
                {ok.hint ? (
                  <p className="mt-1 flex gap-2 text-ink/85">
                    <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {ok.hint}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {!ok?.correct ? (
          <Button type="submit" className="mt-5" disabled={!ready || pending}>
            {pending ? "Checking…" : ok ? (
              <>
                <RotateCcw aria-hidden="true" /> Check again
              </>
            ) : (
              "Check my answer"
            )}
          </Button>
        ) : null}
      </form>

      <div className="mt-6 border-t-2 border-dashed border-border pt-6" aria-live="polite">
        {completed ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <PartyPopper className="mt-0.5 size-7 shrink-0 text-coral-ink" aria-hidden="true" />
              <div>
                <p className="text-xl font-bold text-ink">Lesson complete!</p>
                <p className="text-muted-foreground">Your progress is saved.</p>
              </div>
            </div>
            {badges.length > 0 ? <BadgeList badges={badges} heading="New badge unlocked!" /> : null}
            <Link href={next.href} className={buttonVariants({ size: "lg" })}>
              {next.label} <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : solved ? (
          <div className="space-y-3">
            {error ? <p className="rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">{error}</p> : null}
            <Button size="lg" onClick={finish} disabled={pending}>
              {pending ? "Saving…" : "Finish lesson"} <CheckCircle2 aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <p className="font-semibold text-muted-foreground">Solve the challenge to finish this lesson.</p>
        )}
      </div>
    </section>
  );
}
