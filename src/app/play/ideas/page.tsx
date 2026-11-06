import type { Metadata } from "next";
import { ArrowRight, FlaskConical, Lightbulb, Plus, Target, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { IdeaBadge, IdeaStatusChip } from "@/components/ideas/idea-visuals";
import { buttonVariants } from "@/components/ui/button";
import { ideaLimits } from "@/content/idea-lab";
import { requireChildMode } from "@/lib/auth/session";
import { listIdeas } from "@/lib/data/ideas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Idea Lab" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });

export default function IdeaLabPage(props: PageProps<"/play/ideas">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <IdeaLab {...props} />
    </Suspense>
  );
}

async function IdeaLab({ searchParams }: PageProps<"/play/ideas">) {
  const [{ child, supabase }, query] = await Promise.all([requireChildMode(), searchParams]);
  const ideas = await listIdeas(supabase, child.id);
  const full = ideas.length >= ideaLimits.maxActiveIdeas;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href="/play">Founder HQ</BackLink>

      <header className="mt-5 overflow-hidden rounded-3xl border-2 border-ink bg-coral-soft shadow-[var(--shadow-sticker-lg)]">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl border-2 border-ink bg-surface">
            <FlaskConical className="size-10 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-extrabold text-ink">Idea Lab</h1>
            <p className="mt-1 text-lg text-ink/85">
              Turn a problem you&apos;ve noticed into your very own business idea — one step at a time.
            </p>
          </div>
          {full ? null : (
            <Link href="/play/ideas/new" className={cn(buttonVariants({ size: "lg" }), "shrink-0")}>
              <Plus aria-hidden="true" /> New idea
            </Link>
          )}
        </div>
        <div className="grid border-t-2 border-ink bg-surface sm:grid-cols-3">
          {[
            { icon: Target, title: "A problem", body: "Something annoying, slow or tricky that people deal with." },
            { icon: Lightbulb, title: "A solution", body: "A thing, service or club that makes it better." },
            { icon: Users, title: "Customers", body: "The people it helps — and who would pay for it." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className={cn("flex gap-3 p-4", i > 0 && "border-t-2 border-ink/10 sm:border-l-2 sm:border-t-0")}>
              <Icon className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
              <p className="text-sm text-ink/85">
                <span className="font-bold text-ink">{title}: </span>
                {body}
              </p>
            </div>
          ))}
        </div>
      </header>
      <p className="mt-3 text-sm text-muted-foreground">
        A business idea = a problem + a solution + the customers it helps. Your ideas are private to you and your grown-up.
      </p>

      {query.deleted === "1" ? (
        <p role="status" className="mt-6 rounded-lg bg-mint-soft px-4 py-3 font-semibold text-ink">
          Idea deleted.
        </p>
      ) : null}

      <section aria-labelledby="my-ideas" className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="my-ideas" className="text-2xl font-bold text-ink">
            My ideas
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {ideas.length} of {ideaLimits.maxActiveIdeas}
          </p>
        </div>
        {full ? (
          <p className="mt-3 rounded-lg bg-sun-soft px-4 py-3 font-semibold text-ink">
            You have {ideaLimits.maxActiveIdeas} ideas — that&apos;s the most you can keep. Delete one to start a new idea.
          </p>
        ) : null}

        {ideas.length === 0 ? (
          <div className="mt-4 rounded-3xl border-2 border-dashed border-ink/30 p-8 text-center">
            <Lightbulb className="mx-auto size-12 text-ink/40" aria-hidden="true" />
            <p className="mt-3 text-xl font-bold text-ink">No ideas yet — your first one is waiting!</p>
            <p className="mt-1 text-ink/75">Start with a problem you&apos;ve noticed. We&apos;ll guide you through six short steps.</p>
            <Link href="/play/ideas/new" className={cn(buttonVariants({ size: "lg" }), "mt-5")}>
              <Plus aria-hidden="true" /> Create my first idea
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {ideas.map((idea) => {
              const ready = idea.status === "ready";
              const href = ready ? `/play/ideas/${idea.id}` : `/play/ideas/${idea.id}/edit?step=${idea.wizard_step}`;
              return (
                <li key={idea.id}>
                  <Link
                    href={href}
                    className="flex h-full items-start gap-4 rounded-2xl border-2 border-ink bg-surface p-5 transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-sticker-lg)]"
                  >
                    <IdeaBadge icon={idea.icon_key} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-ink [overflow-wrap:anywhere]">{idea.name}</h3>
                        <IdeaStatusChip status={idea.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-ink/75">{idea.value_statement || idea.problem || "Just getting started…"}</p>
                      <p className="mt-2 flex items-center gap-1 text-sm font-bold text-ink">
                        {ready ? "Open idea" : `Continue at step ${idea.wizard_step}`} <ArrowRight className="size-4" aria-hidden="true" />
                      </p>
                      <p className="text-xs text-muted-foreground">Updated {dateFormat.format(new Date(idea.updated_at))}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
