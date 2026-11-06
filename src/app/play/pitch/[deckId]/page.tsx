import type { Metadata } from "next";
import { Check, Circle, History, Mic, Pencil, PartyPopper, Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { BadgeList } from "@/components/academy/badge-list";
import { IdeaBadge } from "@/components/ideas/idea-visuals";
import { DeckGrid, formatDate, PitchStateChip, PracticeResultView } from "@/components/pitch/pitch-visuals";
import { buttonVariants } from "@/components/ui/button";
import { bandOf } from "@/content/pitch-studio";
import { requireChildMode } from "@/lib/auth/session";
import { getAchievementTitles } from "@/lib/data/academy";
import { getPitch, getPractice, pitchState } from "@/lib/data/pitch";
import { cn } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "My pitch" };

export default function PitchPage(props: PageProps<"/play/pitch/[deckId]">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <PitchOverview {...props} />
    </Suspense>
  );
}

async function PitchOverview({ params, searchParams }: PageProps<"/play/pitch/[deckId]">) {
  const [{ deckId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(deckId).success) notFound();
  // Only the active child's own pitch (child id from Child Mode, not from the URL).
  const pitch = await getPitch(supabase, child.id, deckId);
  if (!pitch) notFound();

  const latest = pitch.versions[0] ?? null;
  const state = pitchState({ status: pitch.status, versionCount: pitch.versions.length });
  const completedPractices = pitch.practices.filter((p) => p.completedAt);
  const lastPractice = completedPractices[0] ? await getPractice(supabase, child.id, completedPractices[0].id) : null;
  const badgeKeys = typeof query.badges === "string" ? query.badges.split(",").filter((k) => /^[a-z0-9-]{1,40}$/.test(k)).slice(0, 5) : [];
  const badges = await getAchievementTitles(supabase, badgeKeys);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play/pitch">Pitch Studio</BackLink>

      {typeof query.finished === "string" ? (
        <div className="mt-5 space-y-4">
          <p className="flex items-center gap-2 rounded-xl bg-mint-soft px-4 py-3 text-lg font-bold text-ink">
            <PartyPopper className="size-6 shrink-0" aria-hidden="true" /> Your pitch is finished! Version {latest?.version ?? 1} is saved.
          </p>
          {badges.length > 0 ? <BadgeList badges={badges} heading="New badge unlocked!" /> : null}
        </div>
      ) : null}

      <header className="mt-5 flex flex-col gap-5 rounded-3xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:flex-row sm:items-center">
        <IdeaBadge icon={pitch.current.icon_key} className="bg-sky-soft" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold text-ink [overflow-wrap:anywhere] sm:text-4xl">{pitch.current.title}</h1>
            <PitchStateChip state={state} version={latest?.version} />
          </div>
          {pitch.current.tagline ? <p className="mt-1 text-lg text-ink/85 [overflow-wrap:anywhere]">{pitch.current.tagline}</p> : null}
          {pitch.projectName ? <p className="mt-1 text-sm text-muted-foreground">From your idea: {pitch.projectName}</p> : null}
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/play/pitch/${pitch.id}/present`} className={buttonVariants({ size: "lg" })}>
          <Play aria-hidden="true" /> Present my pitch
        </Link>
        <Link href={`/play/pitch/${pitch.id}/edit?step=${state === "draft" ? pitch.builderStep : 1}`} className={buttonVariants({ variant: "secondary", size: "lg" })}>
          <Pencil aria-hidden="true" /> {state === "draft" ? "Keep building" : "Improve my pitch"}
        </Link>
        {latest ? (
          <Link href={`/play/pitch/${pitch.id}/investor`} className={buttonVariants({ variant: "accent", size: "lg" })}>
            <Mic aria-hidden="true" /> Investor Room
          </Link>
        ) : null}
      </div>

      <section aria-labelledby="status" className="mt-8 rounded-3xl border-2 border-ink bg-surface p-5 sm:p-6">
        <h2 id="status" className="text-xl font-bold text-ink">
          Completion
        </h2>
        <ul className="mt-3 space-y-2">
          <StatusRow done={Boolean(latest)}>
            {latest ? `Pitch finished — version ${latest.version} saved on ${formatDate(latest.createdAt)}` : "Finish all the required parts of your pitch"}
          </StatusRow>
          <StatusRow done={completedPractices.length > 0}>
            {completedPractices.length > 0
              ? `Investor Room practice done — ${completedPractices.length} practice${completedPractices.length === 1 ? "" : "s"} completed`
              : latest
                ? "Practise answering questions in the Investor Room"
                : "Then practise in the Investor Room"}
          </StatusRow>
        </ul>
        {state === "revising" ? (
          <p className="mt-4 rounded-xl bg-sky-soft px-4 py-3 text-ink">
            You&apos;ve made changes since version {latest?.version}. Finish your pitch again to save them as version {(latest?.version ?? 0) + 1}.
            Your earlier versions and practice feedback are kept.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="deck" className="mt-10">
        <h2 id="deck" className="text-2xl font-bold text-ink">
          {latest ? `Your pitch deck (version ${latest.version})` : "Your deck so far (draft)"}
        </h2>
        <p className="mt-1 text-muted-foreground">Made from your saved answers: a title slide plus one slide for each part.</p>
        <div className="mt-4">
          <DeckGrid deck={latest?.snapshot ?? pitch.current} />
        </div>
      </section>

      {lastPractice ? (
        <section aria-labelledby="latest-practice" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="latest-practice" className="text-2xl font-bold text-ink">
              Latest practice feedback
            </h2>
            <Link href={`/play/pitch/${pitch.id}/investor/${lastPractice.id}`} className="font-bold text-ink underline underline-offset-4">
              See every answer
            </Link>
          </div>
          <p className="mt-1 text-muted-foreground">
            With {lastPractice.personaName} on version {lastPractice.version ?? 1} of your pitch · {formatDate(lastPractice.completedAt ?? lastPractice.createdAt)}
          </p>
          <div className="mt-4">
            <PracticeResultView practice={lastPractice} showAnswers={false} />
          </div>
        </section>
      ) : null}

      {pitch.practices.length > 0 ? (
        <section aria-labelledby="practice-history" className="mt-10">
          <h2 id="practice-history" className="text-2xl font-bold text-ink">
            Practice history
          </h2>
          <ul className="mt-4 grid gap-3">
            {pitch.practices.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/play/pitch/${pitch.id}/investor/${p.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border-2 border-ink/30 bg-surface px-5 py-3 hover:border-ink"
                >
                  <span className="min-w-0 flex-1 font-bold text-ink">{p.personaName}</span>
                  <span className="text-sm text-ink/80">Version {p.version ?? 1}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-ink",
                      p.completedAt ? "bg-mint" : "bg-sun-soft",
                    )}
                  >
                    {p.completedAt ? `${p.totalScore}/100 · ${bandOf(p.band).label}` : "In progress"}
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDate(p.completedAt ?? p.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pitch.versions.length > 0 ? (
        <section aria-labelledby="versions" className="mt-10">
          <h2 id="versions" className="flex items-center gap-2 text-2xl font-bold text-ink">
            <History className="size-6" aria-hidden="true" /> Finished versions
          </h2>
          <p className="mt-1 text-muted-foreground">Every time you finish your pitch, a copy is kept so you can see how it has grown.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {pitch.versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/play/pitch/${pitch.id}/present?version=${v.version}`}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-1.5 font-semibold text-ink hover:bg-muted"
                >
                  Version {v.version} · {formatDate(v.createdAt)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatusRow({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink", done ? "bg-mint" : "bg-surface")}>
        {done ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-2 text-transparent" aria-hidden="true" />}
      </span>
      <span className={cn("font-semibold", done ? "text-ink" : "text-ink/75")}>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {children}
      </span>
    </li>
  );
}
