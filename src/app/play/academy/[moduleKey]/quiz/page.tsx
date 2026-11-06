import type { Metadata } from "next";
import { ArrowRight, ClipboardCheck, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, lessonHref, moduleHref } from "@/components/academy/academy-ui";
import { QuizPlayer } from "@/components/academy/quiz-player";
import { buttonVariants } from "@/components/ui/button";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview, getQuizQuestions, type QuizResult } from "@/lib/data/academy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Module quiz" };

export default function QuizPage(props: PageProps<"/play/academy/[moduleKey]/quiz">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <QuizContent {...props} />
    </Suspense>
  );
}

async function QuizContent({ params }: PageProps<"/play/academy/[moduleKey]/quiz">) {
  const { moduleKey } = await params;
  const { child, supabase } = await requireChildMode();
  const academy = await getAcademyOverview(supabase, child.id);
  const index = academy.modules.findIndex((x) => x.key === moduleKey);
  const m = academy.modules[index];
  if (!m || !m.quiz) notFound();

  if (!m.quiz.unlocked) {
    const nextLesson = m.lessons.find((l) => l.status === "available");
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12 text-center sm:px-6">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full border-2 border-ink bg-muted">
          <Lock className="size-7 text-ink" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold text-ink">The quiz is locked</h1>
        <p className="mt-2 text-lg text-ink/80">Finish every lesson in {m.title} to unlock it.</p>
        <Link href={nextLesson ? lessonHref(m.key, nextLesson.key) : moduleHref(m.key)} className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          Keep learning <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const [questions, review] = await Promise.all([
    getQuizQuestions(supabase, m.quiz.id),
    supabase.rpc("quiz_review", { module_key: m.key }),
  ]);
  const previous = review.data?.status === "ok" ? (review.data as QuizResult) : null;

  const following = academy.modules[index + 1];
  const afterPass = following
    ? { href: moduleHref(following.key), label: `Start Module ${following.position}` }
    : { href: "/play/passport", label: "See your Founder Passport" };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={moduleHref(m.key)}>{m.title}</BackLink>
      <header className="mt-5 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink bg-grape-soft">
          <ClipboardCheck className="size-7 text-ink" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Module {m.position} quiz</p>
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{m.title}</h1>
        </div>
      </header>
      <p className="mt-4 text-lg text-ink/80">
        {questions.length} questions · pass mark {m.quiz.passMark}%. Take your time — you&apos;ll see why each answer is right or wrong afterwards.
      </p>
      <div className="mt-6">
        <QuizPlayer
          moduleKey={m.key}
          questions={questions}
          review={previous}
          passMark={m.quiz.passMark}
          afterPass={afterPass}
          moduleHref={moduleHref(m.key)}
        />
      </div>
    </div>
  );
}
