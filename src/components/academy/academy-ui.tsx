import { ArrowLeft, ArrowRight, Check, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ModuleIcon } from "@/components/academy/module-visuals";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { buttonVariants } from "@/components/ui/button";
import type { ModuleOverview, NextStep } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const lessonHref = (moduleKey: string, lessonKey: string) => `/play/academy/${moduleKey}/${lessonKey}`;
export const quizHref = (moduleKey: string) => `/play/academy/${moduleKey}/quiz`;
export const moduleHref = (moduleKey: string) => `/play/academy/${moduleKey}`;

export function ChildPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-5xl animate-pulse space-y-4 px-4 py-10 sm:px-6">
      <div className="h-8 w-40 rounded-full bg-muted" />
      <div className="h-40 rounded-2xl border-2 border-border bg-surface" />
      <div className="h-24 rounded-2xl border-2 border-border bg-surface" />
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-full font-semibold text-ink/70 hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden="true" /> {children}
    </Link>
  );
}

export function StatusChip({ status }: { status: "completed" | "available" | "locked" | "in-progress" }) {
  const map = {
    completed: { label: "Completed", className: "bg-mint text-ink", icon: <Check className="size-3.5" aria-hidden="true" /> },
    "in-progress": { label: "In progress", className: "bg-sun text-ink", icon: null },
    available: { label: "Ready", className: "bg-sky-soft text-ink", icon: null },
    locked: { label: "Locked", className: "bg-muted text-muted-foreground", icon: <Lock className="size-3.5" aria-hidden="true" /> },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em]", map.className)}>
      {map.icon}
      {map.label}
    </span>
  );
}

export function moduleStatus(m: ModuleOverview): "completed" | "in-progress" | "available" {
  if (m.completed) return "completed";
  if (m.completedLessons > 0 || (m.quiz?.attempts ?? 0) > 0) return "in-progress";
  return "available";
}

export function NextStepCard({ next }: { next: NextStep }) {
  if (next.kind === "done") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-mint-soft p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Trophy className="size-10 shrink-0 text-ink" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-ink">You finished the Founder Academy!</p>
            <p className="text-ink/80">Every module and quiz is complete. Amazing work.</p>
          </div>
        </div>
        <Link href="/play/passport" className={buttonVariants({ size: "lg" })}>
          See your Passport <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }
  const href = next.kind === "lesson" ? lessonHref(next.module.key, next.lesson.key) : quizHref(next.module.key);
  const started = next.module.completedLessons > 0 || next.module.position > 1;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-sun p-6 shadow-[var(--shadow-sticker-lg)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <ModuleIcon icon={next.module.icon} tone={next.module.tone} className="bg-surface" />
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-ink/70">
            {started ? "Up next" : "Start here"} · Module {next.module.position}
          </p>
          <p className="text-xl font-bold text-ink">
            {next.kind === "lesson" ? next.lesson.title : `${next.module.title} quiz`}
          </p>
        </div>
      </div>
      <Link href={href} className={cn(buttonVariants({ size: "lg" }), "shrink-0")}>
        {next.kind === "quiz" ? "Take the quiz" : started ? "Continue" : "Start learning"} <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

export function ModuleCard({ module: m }: { module: ModuleOverview }) {
  const status = moduleStatus(m);
  return (
    <li>
      <Link
        href={moduleHref(m.key)}
        className="group flex h-full flex-col rounded-2xl border-2 border-ink bg-surface p-5 transition-transform duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-sticker-lg)]"
      >
        <div className="flex items-start justify-between gap-3">
          <ModuleIcon icon={m.icon} tone={m.tone} />
          <StatusChip status={status} />
        </div>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Module {m.position}</p>
        <h3 className="mt-0.5 text-xl font-bold text-ink">{m.title}</h3>
        <p className="mt-1 flex-1 text-ink/75">{m.summary}</p>
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-sm font-semibold text-ink/75">
            <span>
              {m.completedLessons} of {m.lessons.length} lessons
            </span>
            <span>{m.quiz?.passed ? "Quiz passed" : m.quiz?.unlocked ? "Quiz ready" : "Quiz locked"}</span>
          </div>
          <ProgressBar
            value={m.completedLessons + (m.quiz?.passed ? 1 : 0)}
            max={m.lessons.length + (m.quiz ? 1 : 0)}
            label={`${m.title} progress`}
          />
        </div>
      </Link>
    </li>
  );
}
