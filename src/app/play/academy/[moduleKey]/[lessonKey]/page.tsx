import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Clock, Lock, MessagesSquare, Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, StatusChip, lessonHref, moduleHref, quizHref } from "@/components/academy/academy-ui";
import { ActivityPlayer } from "@/components/academy/activity-player";
import { LessonBlocks } from "@/components/academy/lesson-blocks";
import { ModuleIcon } from "@/components/academy/module-visuals";
import { buttonVariants } from "@/components/ui/button";
import { requireChildMode } from "@/lib/auth/session";
import { getLessonPage } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Lesson" };

export default function LessonPage(props: PageProps<"/play/academy/[moduleKey]/[lessonKey]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <LessonContent {...props} />
    </Suspense>
  );
}

async function LessonContent({ params }: PageProps<"/play/academy/[moduleKey]/[lessonKey]">) {
  const { moduleKey, lessonKey } = await params;
  const { child, supabase } = await requireChildMode();
  const page = await getLessonPage(supabase, child.id, moduleKey, lessonKey);
  if (!page) notFound();
  const { module: m, lesson, body, activity, previous, next } = page;

  if (lesson.status === "locked") {
    const unlock = m.lessons.find((l) => l.status === "available");
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12 text-center sm:px-6">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full border-2 border-ink bg-muted">
          <Lock className="size-7 text-ink" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">This lesson is still locked</h1>
        <p className="mt-2 text-lg text-ink/80">Finish the lessons before it first — one step at a time!</p>
        <Link href={unlock ? lessonHref(m.key, unlock.key) : moduleHref(m.key)} className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Go to {unlock ? `Lesson ${unlock.position}` : "the module"} <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const after = next
    ? { href: lessonHref(m.key, next.key), label: "Next lesson" }
    : m.quiz
      ? { href: quizHref(m.key), label: "Take the module quiz" }
      : { href: moduleHref(m.key), label: "Back to the module" };

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={moduleHref(m.key)}>{m.title}</BackLink>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-3">
          <ModuleIcon icon={m.icon} tone={m.tone} className="size-11 rounded-xl" iconClassName="size-5" />
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Module {m.position} · Lesson {lesson.position} of {m.lessons.length}
          </p>
          <StatusChip status={lesson.status} />
        </div>
        <h1 className="mt-3 text-4xl font-extrabold text-ink sm:text-5xl">{lesson.title}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" /> About {lesson.minutes} minutes
        </p>
        <ol aria-label="Lessons in this module" className="mt-4 flex gap-1.5">
          {m.lessons.map((l) => (
            <li
              key={l.key}
              aria-label={`Lesson ${l.position}: ${l.status}${l.key === lesson.key ? " (this lesson)" : ""}`}
              className={cn(
                "h-2.5 flex-1 rounded-full border border-ink/15",
                l.status === "completed" ? "bg-mint" : l.key === lesson.key ? "bg-sun" : "bg-muted",
              )}
            />
          ))}
        </ol>
        <p className="mt-6 text-xl leading-relaxed text-ink">{body.intro}</p>
      </header>

      <div className="mt-8">
        <LessonBlocks blocks={body.blocks} />
      </div>

      <section aria-labelledby="reflect" className="mt-8 flex items-start gap-4 rounded-2xl border-2 border-ink bg-grape-soft p-5">
        <MessagesSquare className="mt-0.5 size-7 shrink-0 text-ink" aria-hidden="true" />
        <div>
          <h2 id="reflect" className="font-bold text-ink">
            Talk it over
          </h2>
          <p className="text-ink/85">{body.reflect}</p>
          <p className="mt-1 text-sm text-ink/70">Just think or chat about it — you don&apos;t need to type anything.</p>
        </div>
      </section>

      <div className="mt-8">
        {activity ? (
          <ActivityPlayer
            activity={activity}
            lessonKey={lesson.key}
            solved={page.activitySolved}
            completed={lesson.status === "completed"}
            next={after}
          />
        ) : null}
      </div>

      <section aria-labelledby="takeaway" className="mt-8 flex items-start gap-3 rounded-2xl border-2 border-ink bg-sun-soft p-5">
        <Star className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden="true" />
        <div>
          <h2 id="takeaway" className="text-xs font-bold uppercase tracking-[0.14em] text-ink/70">
            Remember
          </h2>
          <p className="text-lg font-bold text-ink">{body.takeaway}</p>
        </div>
      </section>

      <nav aria-label="Lesson navigation" className="mt-10 flex flex-col-reverse gap-3 border-t-2 border-border pt-6 sm:flex-row sm:justify-between">
        {previous ? (
          <Link href={lessonHref(m.key, previous.key)} className={buttonVariants({ variant: "secondary" })}>
            <ArrowLeft aria-hidden="true" /> Previous lesson
          </Link>
        ) : (
          <Link href={moduleHref(m.key)} className={buttonVariants({ variant: "secondary" })}>
            <ArrowLeft aria-hidden="true" /> Module overview
          </Link>
        )}
        {next && next.status !== "locked" ? (
          <Link href={lessonHref(m.key, next.key)} className={buttonVariants({ variant: "secondary" })}>
            Next lesson <ArrowRight aria-hidden="true" />
          </Link>
        ) : !next && m.quiz?.unlocked ? (
          <Link href={quizHref(m.key)} className={buttonVariants({ variant: "secondary" })}>
            Module quiz <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
