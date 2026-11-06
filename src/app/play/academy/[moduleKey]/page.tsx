import type { Metadata } from "next";
import { Award, Check, ClipboardCheck, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, StatusChip, lessonHref, moduleStatus, quizHref } from "@/components/academy/academy-ui";
import { AppIcon, ModuleIcon } from "@/components/academy/module-visuals";
import { ProgressBar } from "@/components/dashboard/activity-panels";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Academy module" };

export default function ModulePage(props: PageProps<"/play/academy/[moduleKey]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <ModuleContent {...props} />
    </Suspense>
  );
}

async function ModuleContent({ params }: PageProps<"/play/academy/[moduleKey]">) {
  const { moduleKey } = await params;
  const { child, supabase } = await requireChildMode();
  const academy = await getAcademyOverview(supabase, child.id);
  const m = academy.modules.find((x) => x.key === moduleKey);
  if (!m) notFound();

  const { data: badge } = await supabase
    .from("achievements")
    .select("title, description, icon_key")
    .eq("rule->>module", m.key)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play/academy">All modules</BackLink>

      <header className="mt-5 rounded-2xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)]">
        <div className="flex items-start justify-between gap-3">
          <ModuleIcon icon={m.icon} tone={m.tone} className="size-16" iconClassName="size-8" />
          <StatusChip status={moduleStatus(m)} />
        </div>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Module {m.position}</p>
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{m.title}</h1>
        <p className="mt-2 text-lg text-ink/80">{m.summary}</p>
        <div className="mt-5">
          <p className="mb-1.5 text-sm font-bold text-ink">
            {m.completedLessons} of {m.lessons.length} lessons complete
          </p>
          <ProgressBar value={m.completedLessons} max={m.lessons.length} label={`${m.title} lessons completed`} />
        </div>
      </header>

      <h2 className="mt-8 text-2xl font-bold text-ink">Your path</h2>
      <ol className="relative mt-4 space-y-3 before:absolute before:bottom-6 before:left-[1.65rem] before:top-6 before:w-0.5 before:bg-ink/15">
        {m.lessons.map((l) => {
          const locked = l.status === "locked";
          const body = (
            <>
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 font-display font-extrabold",
                  l.status === "completed" && "border-ink bg-mint text-ink",
                  l.status === "available" && "border-ink bg-sun text-ink",
                  locked && "border-ink/20 bg-muted text-muted-foreground",
                )}
              >
                {l.status === "completed" ? <Check className="size-5" aria-hidden="true" /> : locked ? <Lock className="size-4" aria-hidden="true" /> : l.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block font-bold", locked ? "text-muted-foreground" : "text-ink")}>
                  Lesson {l.position}: {l.title}
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden="true" /> {l.minutes} min
                  {locked ? " · Finish the lesson before to unlock" : ""}
                </span>
              </span>
              <StatusChip status={l.status} />
            </>
          );
          return (
            <li key={l.key}>
              {locked ? (
                <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink/20 bg-surface/60 p-3 pr-4" aria-disabled="true">
                  {body}
                </div>
              ) : (
                <Link
                  href={lessonHref(m.key, l.key)}
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border-2 bg-surface p-3 pr-4 transition-transform hover:-translate-y-0.5",
                    l.status === "available" ? "border-ink shadow-[var(--shadow-sticker)]" : "border-ink/30",
                  )}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}

        {m.quiz ? (
          <li>
            {m.quiz.unlocked ? (
              <Link
                href={quizHref(m.key)}
                className={cn(
                  "flex items-center gap-4 rounded-2xl border-2 bg-surface p-3 pr-4 transition-transform hover:-translate-y-0.5",
                  m.quiz.passed ? "border-ink/30" : "border-ink shadow-[var(--shadow-sticker)]",
                )}
              >
                <span className={cn("relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink", m.quiz.passed ? "bg-mint" : "bg-grape-soft")}>
                  <ClipboardCheck className="size-5 text-ink" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-ink">Module quiz</span>
                  <span className="block text-sm text-muted-foreground">
                    {m.quiz.bestScore !== null ? `Best score ${m.quiz.bestScore}% · ` : ""}Pass mark {m.quiz.passMark}%
                  </span>
                </span>
                <StatusChip status={m.quiz.passed ? "completed" : "available"} />
              </Link>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-ink/20 bg-surface/60 p-3 pr-4" aria-disabled="true">
                <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink/20 bg-muted text-muted-foreground">
                  <Lock className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-muted-foreground">Module quiz</span>
                  <span className="block text-sm text-muted-foreground">Finish all lessons to unlock</span>
                </span>
                <StatusChip status="locked" />
              </div>
            )}
          </li>
        ) : null}
      </ol>

      {badge ? (
        <section aria-labelledby="badge-title" className="mt-8 flex items-center gap-4 rounded-2xl border-2 border-ink bg-sun-soft p-5">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-ink", m.completed ? "bg-sun" : "bg-surface")}>
            {m.completed ? (
              <AppIcon name={badge.icon_key} className="size-7 text-ink" aria-hidden="true" />
            ) : (
              <Award className="size-7 text-ink" aria-hidden="true" />
            )}
          </span>
          <div>
            <h2 id="badge-title" className="font-bold text-ink">
              {m.completed ? `Badge earned: ${badge.title}` : `Earn the ${badge.title} badge`}
            </h2>
            <p className="text-ink/80">{m.completed ? badge.description : "Complete every lesson and pass the quiz."}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
