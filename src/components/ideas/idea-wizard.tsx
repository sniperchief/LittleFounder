"use client";

import { ArrowLeft, ArrowRight, Check, Lightbulb, Save, ShieldAlert, Sparkles, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";

import { saveIdeaAction } from "@/app/play/ideas/actions";
import { IdeaIcon, IdeaSummary, missingParts } from "@/components/ideas/idea-visuals";
import { Button } from "@/components/ui/button";
import {
  buyers,
  customerTags,
  firstSteps,
  ideaIcons,
  ideaLimits,
  ideaSteps,
  labelOf,
  privacyNudge,
  problemCategories,
  problemFrequencies,
  solutionTypes,
  specialTags,
} from "@/content/idea-lab";
import type { IdeaFields } from "@/lib/data/ideas";
import { cn } from "@/lib/utils";

type Props = { ideaId: string | null; initial: IdeaFields; initialStep: number; status: string };

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

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

function Question({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-bold text-ink">{label}</legend>
      {hint ? <p className="-mt-2 text-sm text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

function Chip({
  selected,
  onClick,
  children,
  multi,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-left font-semibold transition-colors",
        selected ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink hover:border-ink/60",
      )}
    >
      {selected ? <Check className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
  multiline,
  optional,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
}) {
  const nudge = privacyNudge(value);
  const common = {
    id,
    value,
    maxLength: max,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    "aria-describedby": `${id}-count${nudge ? ` ${id}-nudge` : ""}`,
    className:
      "w-full rounded-xl border-2 border-ink bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink/40 focus-visible:outline-3 focus-visible:outline-ring",
  };
  return (
    <div>
      <label htmlFor={id} className="font-bold text-ink">
        {label} {optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
      </label>
      <div className="mt-1.5">{multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />}</div>
      <p id={`${id}-count`} className="mt-1 text-right text-xs font-semibold text-muted-foreground">
        {value.length}/{max}
      </p>
      {nudge ? (
        <p id={`${id}-nudge`} className="mt-1 flex items-start gap-2 rounded-lg bg-coral-soft px-3 py-2 text-sm font-semibold text-ink">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {nudge}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

const nameEndings = ["Pal", "Buddy", "Hero", "Club", "Helper", "Box", "Squad", "Spark"];
const categoryWords: Record<string, string> = {
  school: "Desk",
  organisation: "Tidy",
  hobbies: "Hobby",
  pets: "Pet",
  environment: "Green",
  home: "Home",
  other: "Bright",
};

export function IdeaWizard({ ideaId, initial, initialStep, status }: Props) {
  const router = useRouter();
  const uid = useId();
  const [fields, setFields] = useState<IdeaFields>(initial);
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), 6));
  const [id, setId] = useState(ideaId);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof IdeaFields>(key: K, value: IdeaFields[K]) => {
    setMessage(null);
    setFields((f) => ({ ...f, [key]: value }));
  };
  const toggle = (key: "target_customer_tags" | "special_tags", value: string, max: number) =>
    setFields((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((x) => x !== value) : list.length < max ? [...list, value] : list };
    });

  const missing = missingParts(fields);
  const category = problemCategories.find((c) => c.key === fields.problem_category);

  function save(nextStep: number, finish = false) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveIdeaAction(id, fields, nextStep, finish);
      if (res.status === "error") {
        setMessage({ tone: "error", text: res.message });
        return;
      }
      if (finish) {
        const badges = res.badges.map((b) => b.key).join(",");
        router.push(`/play/ideas/${res.id}?${status === "ready" ? "saved=1" : "created=1"}${badges ? `&badges=${badges}` : ""}`);
        return;
      }
      if (!id) {
        setId(res.id);
        window.history.replaceState(null, "", `/play/ideas/${res.id}/edit?step=${nextStep}`);
      }
      if (nextStep !== step) {
        setStep(nextStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setMessage({ tone: "ok", text: "Draft saved! You can come back and finish it any time." });
      }
    });
  }

  function suggestSentence() {
    const type = labelOf(solutionTypes, fields.solution_type)?.toLowerCase() ?? "an idea";
    const who = fields.target_customer_tags.map((t) => labelOf(customerTags, t)?.toLowerCase()).filter(Boolean).join(" and ") || "people";
    const what = fields.solution_benefit || (fields.problem ? `with this problem: ${fields.problem.toLowerCase()}` : "");
    const name = fields.name.trim() || "My idea";
    const article = /^[aeiou]/.test(type) ? "an" : "a";
    const sentence = `${name} is ${type.startsWith("a ") || type.startsWith("an ") ? type : `${article} ${type}`} that helps ${who} ${what}`.trim();
    set("value_statement", sentence.slice(0, ideaLimits.valueStatement));
  }

  const stepInfo = ideaSteps[step - 1];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <nav aria-label="Idea steps">
        <ol className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {ideaSteps.map((s, i) => {
            const n = i + 1;
            const current = n === step;
            const done = !missing.some((m) => m.step === n) && n < step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(n)}
                  aria-current={current ? "step" : undefined}
                  className="flex w-full flex-col items-center gap-1 rounded-lg p-1 text-center"
                >
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 font-display font-extrabold",
                      current ? "border-ink bg-sun text-ink" : done ? "border-ink bg-mint text-ink" : "border-ink/25 bg-surface text-ink/60",
                    )}
                  >
                    {done ? <Check className="size-4" aria-hidden="true" /> : n}
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
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-coral-ink">
          Step {step} of 6
        </p>
        <h2 id={`${uid}-title`} className="mt-1 text-3xl font-extrabold text-ink">
          {stepInfo.title}
        </h2>

        <div className="mt-6 space-y-7">
          {step === 1 ? (
            <>
              <Tip title="What makes a problem worth solving?">
                Lots of people have it, it happens often, and people would be glad to see it fixed. Look around you —
                at school, at home, with your hobbies or your pets.
              </Tip>
              <Question label="Where did you notice a problem?">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Problem topic">
                  {problemCategories.map((c) => (
                    <Chip key={c.key} selected={fields.problem_category === c.key} onClick={() => set("problem_category", c.key)}>
                      <span aria-hidden="true">{c.emoji}</span> {c.label}
                    </Chip>
                  ))}
                  <Chip selected={fields.problem_category === "other"} onClick={() => set("problem_category", "other")}>
                    <span aria-hidden="true">💡</span> Something else
                  </Chip>
                </div>
              </Question>
              {category ? (
                <Question label="Pick a problem to start from" hint="Tap one, then change the words to make it yours.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {category.prompts.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set("problem", p)}
                        aria-pressed={fields.problem === p}
                        className={cn(
                          "rounded-xl border-2 px-4 py-3 text-left font-semibold text-ink transition-colors",
                          fields.problem === p ? "border-ink bg-sun-soft" : "border-border hover:border-ink/60",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Question>
              ) : null}
              <TextInput
                id={`${uid}-problem`}
                label="The problem in your own words"
                value={fields.problem}
                onChange={(v) => set("problem", v)}
                max={ideaLimits.problem}
                placeholder="e.g. My little brother's toys are always all over the floor"
                multiline
              />
              <TextInput
                id={`${uid}-who`}
                label="Who has this problem?"
                value={fields.problem_who}
                onChange={(v) => set("problem_who", v)}
                max={ideaLimits.problemWho}
                placeholder="e.g. Kids in my class, families with dogs"
                optional
              />
              <Question label="How often does it happen?">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How often">
                  {problemFrequencies.map((f) => (
                    <Chip key={f.key} selected={fields.problem_frequency === f.key} onClick={() => set("problem_frequency", f.key)}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </Question>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Tip title="Practical beats perfect">
                The best first ideas are simple. Could you make a rough version with things you already have? A clip,
                a chart, a club or a service can solve a real problem.
              </Tip>
              {fields.problem ? (
                <p className="rounded-xl bg-muted px-4 py-3 text-ink">
                  <span className="font-bold">Your problem: </span>
                  {fields.problem}
                </p>
              ) : null}
              <Question label="What kind of solution is it?">
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Solution type">
                  {solutionTypes.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={fields.solution_type === t.key}
                      onClick={() => set("solution_type", t.key)}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3 text-left transition-colors",
                        fields.solution_type === t.key ? "border-ink bg-coral-soft" : "border-border hover:border-ink/60",
                      )}
                    >
                      <span className="block font-bold text-ink">{t.label}</span>
                      <span className="block text-sm text-ink/70">Like {t.example}</span>
                    </button>
                  ))}
                </div>
              </Question>
              <TextInput
                id={`${uid}-solution`}
                label="What's your idea?"
                value={fields.solution}
                onChange={(v) => set("solution", v)}
                max={ideaLimits.solution}
                placeholder="e.g. A toy box with picture labels so little kids know where everything goes"
                multiline
              />
              <TextInput
                id={`${uid}-benefit`}
                label="Why would it help?"
                value={fields.solution_benefit}
                onChange={(v) => set("solution_benefit", v)}
                max={ideaLimits.solutionBenefit}
                placeholder="e.g. Tidying up becomes quick and fun"
                optional
              />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Tip title="Users and buyers can be different people">
                The <strong>user</strong> is who uses it; the <strong>buyer</strong> is who pays. A toddler plays with a bath toy,
                but a parent buys it. Some ideas are free — a school, charity or another business might cover the cost.
              </Tip>
              <Question label="Who would use your idea?" hint="Pick everyone who would use it.">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Users">
                  {customerTags.map((t) => (
                    <Chip key={t.key} multi selected={fields.target_customer_tags.includes(t.key)} onClick={() => toggle("target_customer_tags", t.key, 10)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </Question>
              <Question label="Who would pay for it?">
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Buyer">
                  {buyers.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      role="radio"
                      aria-checked={fields.buyer === b.key}
                      onClick={() => set("buyer", b.key)}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3 text-left transition-colors",
                        fields.buyer === b.key ? "border-ink bg-sky-soft" : "border-border hover:border-ink/60",
                      )}
                    >
                      <span className="block font-bold text-ink">{b.label}</span>
                      <span className="block text-sm text-ink/70">{b.hint}</span>
                    </button>
                  ))}
                </div>
              </Question>
              <TextInput
                id={`${uid}-note`}
                label="Anything else about your customers?"
                value={fields.target_customer_note}
                onChange={(v) => set("target_customer_note", v)}
                max={ideaLimits.customerNote}
                placeholder="e.g. They're busy in the mornings — no real names please!"
                optional
              />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Tip title="Great names are short and easy to say">
                A good name is easy to remember and gives a clue about what your idea does. Say it out loud — does it sound fun?
              </Tip>
              <TextInput
                id={`${uid}-name`}
                label="Your idea's name"
                value={fields.name}
                onChange={(v) => set("name", v)}
                max={ideaLimits.name}
                placeholder="e.g. Tidy Tiger"
              />
              <Question label="Need inspiration?" hint="Tap a suggestion to use it.">
                <div className="flex flex-wrap gap-2">
                  {nameEndings.slice(0, 6).map((end) => {
                    const suggestion = `${categoryWords[fields.problem_category ?? "other"] ?? "Bright"} ${end}`;
                    return (
                      <Chip key={end} selected={fields.name === suggestion} onClick={() => set("name", suggestion)}>
                        {suggestion}
                      </Chip>
                    );
                  })}
                </div>
              </Question>
              <Question label="Pick a logo">
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Logo">
                  {ideaIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      role="radio"
                      aria-checked={fields.icon_key === icon}
                      aria-label={icon}
                      onClick={() => set("icon_key", icon)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-2xl border-2 transition-colors",
                        fields.icon_key === icon ? "border-ink bg-coral-soft shadow-[var(--shadow-sticker)]" : "border-border bg-surface hover:border-ink/60",
                      )}
                    >
                      <IdeaIcon name={icon} className="size-7 text-ink" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </Question>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <Tip title="Sum it up in one sentence">
                Founders explain their idea quickly: what it is, who it helps and how. Tap the magic button to start from your answers.
              </Tip>
              <div>
                <TextInput
                  id={`${uid}-sentence`}
                  label="Your idea in one sentence"
                  value={fields.value_statement}
                  onChange={(v) => set("value_statement", v)}
                  max={ideaLimits.valueStatement}
                  placeholder="e.g. Tidy Tiger is a toy box that helps little kids tidy up quickly"
                  multiline
                />
                <Button type="button" variant="secondary" size="sm" className="mt-1" onClick={suggestSentence}>
                  <Wand2 aria-hidden="true" /> Use my answers
                </Button>
              </div>
              <Question label="What makes it special?" hint="Pick up to 3.">
                <div className="flex flex-wrap gap-2" role="group" aria-label="What makes it special">
                  {specialTags.map((t) => (
                    <Chip key={t.key} multi selected={fields.special_tags.includes(t.key)} onClick={() => toggle("special_tags", t.key, 3)}>
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </Question>
              <Question label="What would you test first?">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="First step">
                  {firstSteps.map((s) => (
                    <Chip key={s.key} selected={fields.first_step === s.key} onClick={() => set("first_step", s.key)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </Question>
            </>
          ) : null}

          {step === 6 ? (
            <>
              <div className="flex items-center gap-4 rounded-2xl border-2 border-ink bg-coral-soft p-5">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-surface">
                  <IdeaIcon name={fields.icon_key} className="size-8 text-ink" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-ink/70">Your idea</p>
                  <p className="text-2xl font-extrabold text-ink [overflow-wrap:anywhere]">{fields.name.trim() || "No name yet"}</p>
                </div>
              </div>
              <IdeaSummary idea={fields} headingLevel="h3" />
              {missing.length > 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-ink/40 p-5">
                  <p className="font-bold text-ink">Still to do before you can create your idea:</p>
                  <ul className="mt-2 space-y-2">
                    {missing.map((m) => (
                      <li key={m.label} className="flex flex-wrap items-center gap-3">
                        <span className="text-ink">{m.label}</span>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setStep(m.step)}>
                          Go to step {m.step}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-xl bg-mint-soft px-4 py-3 font-semibold text-ink">
                  Everything is filled in! No idea is guaranteed to work — testing it is how founders find out. Ready to create it?
                </p>
              )}
            </>
          ) : null}
        </div>

        <div aria-live="polite" className="mt-6">
          {message ? (
            <p className={cn("rounded-lg px-4 py-3 font-semibold text-ink", message.tone === "ok" ? "bg-mint-soft" : "bg-coral-soft")}>{message.text}</p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t-2 border-dashed border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
                <ArrowLeft aria-hidden="true" /> Back
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => save(step)} disabled={pending}>
              <Save aria-hidden="true" /> {pending ? "Saving…" : "Save draft"}
            </Button>
          </div>
          {step < 6 ? (
            <Button type="button" onClick={() => save(step + 1)} disabled={pending}>
              {pending ? "Saving…" : "Save & continue"} <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => save(6, true)} disabled={pending || missing.length > 0}>
              <Sparkles aria-hidden="true" /> {pending ? "Saving…" : status === "ready" ? "Save my idea" : "Create my idea!"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
