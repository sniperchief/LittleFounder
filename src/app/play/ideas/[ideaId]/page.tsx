import type { Metadata } from "next";
import { BookOpen, Check, PartyPopper, Pencil, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton, lessonHref } from "@/components/academy/academy-ui";
import { BadgeList } from "@/components/academy/badge-list";
import { IdeaBadge, IdeaStatusChip, IdeaSummary, missingParts } from "@/components/ideas/idea-visuals";
import { buttonVariants } from "@/components/ui/button";
import { firstSteps, ideaConcepts, labelOf } from "@/content/idea-lab";
import { requireChildMode } from "@/lib/auth/session";
import { getAcademyOverview, getAchievementTitles } from "@/lib/data/academy";
import { getIdea, toFields } from "@/lib/data/ideas";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "My idea" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export default function IdeaPage(props: PageProps<"/play/ideas/[ideaId]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <IdeaWorkspace {...props} />
    </Suspense>
  );
}

async function IdeaWorkspace({ params, searchParams }: PageProps<"/play/ideas/[ideaId]">) {
  const [{ ideaId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(ideaId).success) notFound();
  const idea = await getIdea(supabase, child.id, ideaId);
  if (!idea) notFound();

  const badgeKeys = typeof query.badges === "string" ? query.badges.split(",").filter((k) => /^[a-z0-9-]{1,40}$/.test(k)).slice(0, 5) : [];
  const [academy, badges] = await Promise.all([getAcademyOverview(supabase, child.id), getAchievementTitles(supabase, badgeKeys)]);
  const lessonStatus = new Map(academy.modules.flatMap((m) => m.lessons.map((l) => [l.key, l.status] as const)));
  const ready = idea.status === "ready";
  const todo = missingParts(toFields(idea));
  const firstStep = labelOf(firstSteps, idea.first_step);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play/ideas">Idea Lab</BackLink>

      {query.created === "1" && ready ? (
        <section aria-live="polite" className="mt-5 rounded-3xl border-2 border-ink bg-mint-soft p-6 text-center shadow-[var(--shadow-sticker-lg)]">
          <PartyPopper className="mx-auto size-10 text-ink" aria-hidden="true" />
          <p className="mt-2 text-2xl font-extrabold text-ink">Your idea is created!</p>
          <p className="mt-1 text-ink/80">That&apos;s real founder thinking. Next, test it — that&apos;s how founders find out what works.</p>
          {badges.length > 0 ? (
            <div className="mx-auto mt-4 max-w-xl text-left">
              <BadgeList badges={badges} heading="New badge unlocked!" />
            </div>
          ) : null}
        </section>
      ) : null}

      {query.saved === "1" ? (
        <p role="status" className="mt-5 rounded-lg bg-mint-soft px-4 py-3 font-semibold text-ink">
          Changes saved!
        </p>
      ) : null}

      {query.saved === "1" ? (
        <p role="status" className="mt-5 rounded-lg bg-mint-soft px-4 py-3 font-semibold text-ink">
          Changes saved!
        </p>
      ) : null}

      <header className="mt-5 flex flex-col gap-5 rounded-3xl border-2 border-ink bg-surface p-6 sm:flex-row sm:items-center sm:p-8">
        <IdeaBadge icon={idea.icon_key} className="size-20 rounded-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-4xl">{idea.name}</h1>
            <IdeaStatusChip status={idea.status} />
          </div>
          {idea.value_statement ? <p className="mt-2 text-lg text-ink/85">{idea.value_statement}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">
            Started {dateFormat.format(new Date(idea.created_at))} · Last saved {dateFormat.format(new Date(idea.updated_at))}
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link href={`/play/ideas/${idea.id}/edit?step=1`} className={buttonVariants()}>
          <Pencil aria-hidden="true" /> Edit idea
        </Link>
        {!ready ? (
          <Link href={`/play/ideas/${idea.id}/edit?step=${todo[0]?.step ?? idea.wizard_step}`} className={buttonVariants({ variant: "accent" })}>
            <Rocket aria-hidden="true" /> Continue building
          </Link>
        ) : null}
        <Link href={`/play/ideas/${idea.id}/delete`} className={cn(buttonVariants({ variant: "ghost" }), "sm:ml-auto")}>
          <Trash2 aria-hidden="true" /> Delete
        </Link>
      </div>

      {!ready && todo.length > 0 ? (
        <p className="mt-4 rounded-lg bg-sun-soft px-4 py-3 font-semibold text-ink">
          This idea is still a draft — {todo.length} {todo.length === 1 ? "part is" : "parts are"} left to fill in.
        </p>
      ) : null}

      <div className="mt-8">
        <IdeaSummary idea={idea} />
      </div>

      {ready ? (
        <section aria-labelledby="develop" className="mt-8 rounded-3xl border-2 border-ink bg-sun-soft p-6">
          <h2 id="develop" className="flex items-center gap-2 text-2xl font-bold text-ink">
            <Rocket className="size-6" aria-hidden="true" /> Keep developing it
          </h2>
          <ul className="mt-3 space-y-2 text-ink/85">
            {firstStep ? (
              <li className="flex gap-2">
                <Check className="mt-1 size-4 shrink-0" aria-hidden="true" /> Your first test: <strong className="text-ink">{firstStep}</strong>.
              </li>
            ) : null}
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0" aria-hidden="true" /> Ask a few people (with your grown-up) if they have the problem — remember, no personal details.
            </li>
            <li className="flex gap-2">
              <Check className="mt-1 size-4 shrink-0" aria-hidden="true" /> Improve your answers any time with “Edit idea”.
            </li>
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="concepts" className="mt-8">
        <h2 id="concepts" className="flex items-center gap-2 text-2xl font-bold text-ink">
          <BookOpen className="size-6" aria-hidden="true" /> Learn more in the Academy
        </h2>
        <p className="mt-1 text-ink/75">These lessons help with each part of your idea.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {ideaConcepts.map((c) => {
            const status = lessonStatus.get(c.lesson);
            const open = status && status !== "locked";
            const inner = (
              <>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.step}</span>
                <span className="block font-bold text-ink">{c.title}</span>
                <span className="block text-sm text-ink/70">
                  {status === "completed" ? "Completed ✓" : status === "available" ? "Ready to learn" : "Unlocks as you learn"}
                </span>
              </>
            );
            return (
              <li key={c.lesson}>
                {open ? (
                  <Link href={lessonHref(c.module, c.lesson)} className="block rounded-xl border-2 border-ink/30 bg-surface p-4 hover:border-ink">
                    {inner}
                  </Link>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-ink/20 bg-surface/60 p-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
