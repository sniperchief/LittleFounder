"use client";

import { ArrowLeft, ArrowRight, Check, Flag, Lightbulb, Quote, Save, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";

import { savePitchAction } from "@/app/play/pitch/actions";
import { IdeaIcon } from "@/components/ideas/idea-visuals";
import { Slide } from "@/components/pitch/pitch-visuals";
import { Button } from "@/components/ui/button";
import { ideaIcons } from "@/content/idea-lab";
import { pitchLimits, pitchPrivacyIssue, pitchSections, pitchSteps, pitchThemes } from "@/content/pitch-studio";
import type { PitchSnapshot } from "@/lib/data/pitch";
import { cn } from "@/lib/utils";

type Fields = Record<string, string>;

type Props = {
  deckId: string;
  initial: PitchSnapshot;
  initialStep: number;
  /** Finished versions so far (0 = never finished). */
  versionCount: number;
  prefilled: boolean;
};

function toFields(s: PitchSnapshot): Fields {
  const f: Fields = { title: s.title === "My pitch" ? "" : s.title, tagline: s.tagline, icon_key: s.icon_key, theme_key: s.theme_key };
  for (const sec of pitchSections) {
    f[sec.key] = s.sections[sec.key].main;
    f[`${sec.key}_extra`] = s.sections[sec.key].extra;
  }
  return f;
}

function toSnapshot(f: Fields): PitchSnapshot {
  return {
    title: f.title.trim() || "My pitch",
    tagline: f.tagline,
    icon_key: f.icon_key,
    theme_key: f.theme_key,
    sections: Object.fromEntries(pitchSections.map((s) => [s.key, { main: f[s.key], extra: f[`${s.key}_extra`] }])) as PitchSnapshot["sections"],
  };
}

/** Required parts that aren't filled in yet (same rule as the database). */
export function missingRequired(f: Fields): string[] {
  const missing: string[] = [];
  if (f.title.trim().length < 2) missing.push("title");
  for (const s of pitchSections) if (s.required && f[s.key].trim().length < pitchLimits.minRequired) missing.push(s.key);
  return missing;
}

const labelFor = (key: string) => (key === "title" ? "Business name" : (pitchSections.find((s) => s.key === key)?.title ?? key));
const stepFor = (key: string) => (key === "title" ? 6 : pitchSections.findIndex((s) => s.key === key) + 1);

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex gap-3 rounded-2xl border-2 border-ink bg-sun-soft p-4">
      <Lightbulb className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
      <div>
        <p className="font-bold text-ink">{title}</p>
        <div className="text-ink/85">{children}</div>
      </div>
    </aside>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
  required,
  rows = 3,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  error?: string;
}) {
  const nudge = pitchPrivacyIssue(value);
  const describedBy = [`${id}-count`, nudge ? `${id}-nudge` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="font-bold text-ink">
        {label}{" "}
        {required ? (
          <span className="ml-1 rounded-full bg-coral-soft px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">Required</span>
        ) : (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        aria-invalid={Boolean(nudge || error) || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink/40 focus-visible:outline-3 focus-visible:outline-ring"
      />
      <p id={`${id}-count`} className="mt-1 text-right text-xs font-semibold text-muted-foreground">
        {value.length}/{max}
      </p>
      {nudge ? (
        <p id={`${id}-nudge`} role="alert" className="mt-1 flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-sm font-semibold text-ink">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {nudge} We can&apos;t save this until it&apos;s removed.
        </p>
      ) : error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-coral-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PitchBuilder({ deckId, initial, initialStep, versionCount, prefilled }: Props) {
  const router = useRouter();
  const uid = useId();
  const [fields, setFields] = useState<Fields>(() => toFields(initial));
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), 6));
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; missing?: string[] } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string) => {
    setMessage(null);
    setFieldErrors((e) => ({ ...e, [key]: "" }));
    setFields((f) => ({ ...f, [key]: value }));
  };

  const missing = missingRequired(fields);
  const privacyBlocked = Object.entries(fields).some(([k, v]) => k !== "icon_key" && k !== "theme_key" && pitchPrivacyIssue(v));
  const snapshot = toSnapshot(fields);

  function save(nextStep: number, finish = false) {
    setMessage(null);
    if (privacyBlocked) {
      setMessage({ tone: "error", text: "Please remove personal details, contact details or links before saving." });
      return;
    }
    if (finish && missing.length > 0) {
      setMessage({ tone: "error", text: "A few required parts still need a little more.", missing });
      return;
    }
    startTransition(async () => {
      const res = await savePitchAction(deckId, fields, nextStep, finish);
      if (res.status === "error") {
        setFieldErrors(res.fieldErrors ?? {});
        setMessage({ tone: "error", text: res.message, missing: res.missing });
        return;
      }
      if (finish) {
        const badges = res.badges.map((b) => b.key).join(",");
        router.push(`/play/pitch/${deckId}?finished=${res.version ?? 1}${badges ? `&badges=${badges}` : ""}`);
        return;
      }
      window.history.replaceState(null, "", `/play/pitch/${deckId}/edit?step=${nextStep}`);
      if (nextStep !== step) {
        setStep(nextStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMessage({ tone: "ok", text: "Saved! You can come back and carry on any time." });
      }
    });
  }

  const section = step <= 5 ? pitchSections[step - 1] : null;

  return (
    <div className="space-y-6">
      {prefilled && step === 1 ? (
        <p className="rounded-xl bg-mint-soft px-4 py-3 font-semibold text-ink">
          We filled in some parts using your Idea Lab idea. Read them through and change anything you like!
        </p>
      ) : null}

      <nav aria-label="Pitch steps">
        <ol className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {pitchSteps.map((s, i) => {
            const n = i + 1;
            const current = n === step;
            const sec = pitchSections[i];
            const done = sec ? fields[sec.key].trim().length >= (sec.required ? pitchLimits.minRequired : 1) : missing.length === 0;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => (n === step ? undefined : save(n))}
                  aria-current={current ? "step" : undefined}
                  className="flex w-full flex-col items-center gap-1 rounded-lg p-1 text-center"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 font-display font-extrabold",
                      current ? "border-ink bg-sun text-ink" : done ? "border-ink bg-mint text-ink" : "border-ink/25 bg-surface text-ink/60",
                    )}
                  >
                    {done && !current ? <Check className="size-4" aria-hidden="true" /> : n === 6 ? <Flag className="size-4" aria-hidden="true" /> : n}
                  </span>
                  <span className={cn("hidden text-xs font-bold sm:block", current ? "text-ink" : "text-muted-foreground")}>{s.short}</span>
                  <span className="sr-only sm:hidden">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section aria-labelledby={`${uid}-title`} className="rounded-3xl border-2 border-ink bg-surface p-5 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral-ink">Step {step} of 6</p>
        <h2 id={`${uid}-title`} className="mt-1 text-3xl font-extrabold text-ink">
          {section ? `${section.title}` : "Your title slide"}
        </h2>
        {section ? <p className="mt-1 text-lg font-semibold text-ink/80">{section.question}</p> : null}

        <div className="mt-6 space-y-6">
          {section ? (
            <>
              <Tip title={section.required ? "What is this part?" : "What is this part? (optional)"}>{section.explain}</Tip>
              <div className="flex gap-3 rounded-2xl border-2 border-dashed border-ink/30 p-4">
                <Quote className="mt-0.5 size-5 shrink-0 text-ink/60" aria-hidden="true" />
                <p className="text-ink/85">
                  <span className="font-bold text-ink">Example: </span>
                  {section.example}
                </p>
              </div>
              <TextArea
                id={`${uid}-${section.key}`}
                label={section.mainLabel}
                value={fields[section.key]}
                onChange={(v) => set(section.key, v)}
                max={pitchLimits.main}
                placeholder={section.mainPlaceholder}
                required={section.required}
                rows={4}
                error={fieldErrors[section.key]}
              />
              <TextArea
                id={`${uid}-${section.key}-extra`}
                label={section.extraLabel}
                value={fields[`${section.key}_extra`]}
                onChange={(v) => set(`${section.key}_extra`, v)}
                max={pitchLimits.extra}
                placeholder={section.extraPlaceholder}
                rows={2}
                error={fieldErrors[`${section.key}_extra`]}
              />
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Your slide so far</p>
                <div className="mx-auto max-w-md">
                  <Slide deck={snapshot} index={step} />
                </div>
              </div>
            </>
          ) : (
            <FinishStep fields={fields} set={set} uid={uid} snapshot={snapshot} missing={missing} goTo={(n) => save(n)} fieldErrors={fieldErrors} />
          )}
        </div>

        {message ? (
          <div
            role={message.tone === "error" ? "alert" : "status"}
            className={cn("mt-6 rounded-lg px-4 py-3 font-semibold text-ink", message.tone === "error" ? "bg-coral-soft" : "bg-mint-soft")}
          >
            <p>{message.text}</p>
            {message.missing?.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {message.missing.map((m) => (
                  <li key={m}>
                    <button type="button" onClick={() => save(stepFor(m))} className="rounded-full border-2 border-ink bg-surface px-3 py-1 text-sm">
                      Go to {labelFor(m)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            {step > 1 ? (
              <Button variant="secondary" disabled={pending} onClick={() => save(step - 1)}>
                <ArrowLeft aria-hidden="true" /> Back
              </Button>
            ) : null}
            <Button variant="ghost" disabled={pending} onClick={() => save(step)}>
              <Save aria-hidden="true" /> Save draft
            </Button>
          </div>
          {step < 6 ? (
            <Button size="lg" disabled={pending} onClick={() => save(step + 1)}>
              {pending ? "Saving…" : "Save & continue"} <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button size="lg" variant="accent" disabled={pending} onClick={() => save(6, true)}>
              <Flag aria-hidden="true" /> {pending ? "Saving…" : versionCount > 0 ? "Save as a new version" : "Finish my pitch"}
            </Button>
          )}
        </div>
        {step === 6 && versionCount > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Your earlier finished version{versionCount > 1 ? "s" : ""} and practice feedback stay saved. Finishing again adds version {versionCount + 1}.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function FinishStep({
  fields,
  set,
  uid,
  snapshot,
  missing,
  goTo,
  fieldErrors,
}: {
  fields: Fields;
  set: (key: string, value: string) => void;
  uid: string;
  snapshot: PitchSnapshot;
  missing: string[];
  goTo: (step: number) => void;
  fieldErrors: Record<string, string>;
}) {
  const titleIssue = pitchPrivacyIssue(fields.title);
  return (
    <>
      <Tip title="Make a great first impression">
        Your title slide is the first thing people see. Give your business a short, memorable name and one sentence that sums it up.
      </Tip>
      <div>
        <label htmlFor={`${uid}-name`} className="font-bold text-ink">
          Business name{" "}
          <span className="ml-1 rounded-full bg-coral-soft px-2 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink">Required</span>
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          value={fields.title}
          maxLength={pitchLimits.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Puzzle Pup"
          aria-invalid={Boolean(titleIssue || fieldErrors.title) || undefined}
          className="mt-1.5 w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink/40 focus-visible:outline-3 focus-visible:outline-ring"
        />
        {titleIssue ? (
          <p role="alert" className="mt-1 flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-sm font-semibold text-ink">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {titleIssue}
          </p>
        ) : null}
      </div>
      <TextArea
        id={`${uid}-tagline`}
        label="Short description"
        value={fields.tagline}
        onChange={(v) => set("tagline", v)}
        max={pitchLimits.tagline}
        placeholder="e.g. Puzzle Pup keeps bored dogs busy and happy"
        rows={2}
        error={fieldErrors.tagline}
      />
      <fieldset>
        <legend className="font-bold text-ink">Pick an icon</legend>
        <div role="radiogroup" aria-label="Icon" className="mt-2 flex flex-wrap gap-2">
          {ideaIcons.map((icon) => (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={fields.icon_key === icon}
              aria-label={icon}
              onClick={() => set("icon_key", icon)}
              className={cn(
                "flex size-12 items-center justify-center rounded-xl border-2",
                fields.icon_key === icon ? "border-ink bg-sun shadow-[var(--shadow-sticker)]" : "border-border bg-surface hover:border-ink/60",
              )}
            >
              <IdeaIcon name={icon} className="size-6 text-ink" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-bold text-ink">Pick colours for your slides</legend>
        <div role="radiogroup" aria-label="Slide colours" className="mt-2 flex flex-wrap gap-2">
          {pitchThemes.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={fields.theme_key === t.key}
              onClick={() => set("theme_key", t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 font-semibold text-ink",
                fields.theme_key === t.key ? "border-ink shadow-[var(--shadow-sticker)]" : "border-border hover:border-ink/60",
                t.slide,
              )}
            >
              <span className={cn("size-4 rounded-full border-2 border-ink", t.accent)} aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Title slide preview</p>
        <div className="mx-auto max-w-md">
          <Slide deck={snapshot} index={0} />
        </div>
      </div>

      <section aria-label="Pitch checklist" className="rounded-2xl border-2 border-ink p-4">
        <p className="font-bold text-ink">Pitch checklist</p>
        <ul className="mt-2 space-y-1.5">
          {[{ key: "title", title: "Business name", required: true }, ...pitchSections].map((s) => {
            const done = !missing.includes(s.key) && (s.key === "title" || fields[s.key].trim().length > 0);
            return (
              <li key={s.key} className="flex flex-wrap items-center gap-2">
                <span className={cn("flex size-6 items-center justify-center rounded-full border-2 border-ink", done ? "bg-mint" : "bg-surface")}>
                  {done ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </span>
                <span className="font-semibold text-ink">{s.title}</span>
                <span className="text-sm text-muted-foreground">
                  {done ? "Done" : s.required ? "Required, still to do" : "Optional"}
                </span>
                {!done && s.key !== "title" ? (
                  <button type="button" onClick={() => goTo(stepFor(s.key))} className="text-sm font-bold text-ink underline underline-offset-4">
                    Go to step {stepFor(s.key)}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {missing.length === 0 ? <p className="mt-3 font-semibold text-ink">Everything required is filled in. You&apos;re ready to finish!</p> : null}
      </section>
    </>
  );
}
