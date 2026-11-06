import { Award, BookOpen, ChartLine, Check, FlaskConical, Presentation, ScrollText, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ChildActivity } from "@/lib/data/children";
import { cn } from "@/lib/utils";

// Parent Dashboard panels. Everything shown is read from stored rows; when nothing
// exists yet we say so plainly (and say which features haven't launched yet).

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

export function StatTile({ label, value, tone = "bg-muted" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className={cn("flex flex-col-reverse rounded-lg px-4 py-3", tone)}>
      <dt className="text-sm font-semibold text-ink/75">{label}</dt>
      <dd className="font-display text-2xl font-extrabold text-ink">{value}</dd>
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 overflow-hidden rounded-full border border-ink/15 bg-muted"
    >
      <div className="h-full rounded-full bg-mint" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Panel({
  icon: Icon,
  tone,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={cn("rounded-xl border-2 border-ink bg-surface p-6", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl border-2 border-ink", tone)}>
          <Icon className="size-5 text-ink" aria-hidden="true" />
        </span>
        <h2 id={id} className="text-xl font-bold text-ink">
          {title}
        </h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function EmptyNote({ children, comingSoon }: { children: ReactNode; comingSoon?: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-ink/20 px-4 py-5 text-center">
      <p className="text-muted-foreground">{children}</p>
      {comingSoon ? (
        <p className="mt-2 inline-block rounded-full bg-muted px-3 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {comingSoon}
        </p>
      ) : null}
    </div>
  );
}

export function LearningPanel({ activity }: { activity: ChildActivity }) {
  return (
    <Panel icon={BookOpen} tone="bg-sun-soft" title="Learning progress" className="lg:col-span-2">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Modules completed" value={`${activity.modulesCompleted} / ${activity.modules.length}`} tone="bg-sun-soft" />
        <StatTile label="Lessons completed" value={activity.lessonsCompleted} />
        <StatTile label="Lessons available" value={activity.lessonsAvailable} />
      </dl>
      {activity.lessonsCompleted === 0 ? (
        <div className="mt-5">
          <EmptyNote>No lessons completed yet. Start Child Mode and open the Founder Academy to begin.</EmptyNote>
        </div>
      ) : activity.lastActivityAt ? (
        <p className="mt-4 text-sm text-muted-foreground">Last learning activity: {dateFormat.format(new Date(activity.lastActivityAt))}</p>
      ) : null}
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {activity.modules.map((m) => (
          <li key={m.key} className="rounded-lg border-2 border-border px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-ink">
                <span className="text-muted-foreground">{m.position}.</span> {m.title}
              </p>
              <p className="shrink-0 text-sm text-muted-foreground">
                {m.totalLessons > 0 ? `${m.completedLessons}/${m.totalLessons} lessons` : "—"}
              </p>
            </div>
            <div className="mt-2">
              <ProgressBar value={m.completedLessons} max={m.totalLessons} label={`${m.title} lessons completed`} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/75">
              {m.quizPassed && m.completedLessons === m.totalLessons ? (
                <>
                  <Check className="size-4 text-ink" aria-hidden="true" />
                  <span className="font-semibold text-ink">Module complete</span>
                  <span>· quiz best {m.quizBestScore}%</span>
                </>
              ) : m.quizAttempts > 0 ? (
                <span>
                  Quiz: best {m.quizBestScore}% · {m.quizAttempts} {m.quizAttempts === 1 ? "attempt" : "attempts"}
                  {m.quizPassed ? " · passed" : " · not passed yet"}
                </span>
              ) : (
                <span>Quiz not taken yet</span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function QuizPanel({ activity }: { activity: ChildActivity }) {
  const { quiz } = activity;
  return (
    <Panel icon={Trophy} tone="bg-grape-soft" title="Quiz performance">
      {quiz.attempts === 0 ? (
        <EmptyNote>No quizzes taken yet. Each module ends with a short quiz.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <StatTile label="Quizzes passed" value={`${quiz.passed} / ${activity.modules.length}`} tone="bg-grape-soft" />
            <StatTile label="Attempts" value={quiz.attempts} />
            <StatTile label="Best score" value={`${quiz.bestScore}%`} />
            <StatTile label="Average score" value={`${quiz.averageScore}%`} />
          </dl>
          <ul className="mt-4 divide-y divide-border">
            {activity.modules
              .filter((m) => m.quizAttempts > 0)
              .map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-semibold text-ink">{m.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {m.quizBestScore}% best · {m.quizPassed ? "passed" : "not passed"}
                  </span>
                </li>
              ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function IdeasPanel({ activity, childId }: { activity: ChildActivity; childId: string }) {
  const created = activity.ideas.filter((i) => i.status === "ready").length;
  const drafts = activity.ideas.length - created;
  return (
    <Panel icon={FlaskConical} tone="bg-coral-soft" title="Startup ideas">
      {activity.ideas.length === 0 ? (
        <EmptyNote>No ideas saved yet. Ideas your child creates in the Idea Lab appear here.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <StatTile label="Ideas created" value={created} tone="bg-coral-soft" />
            <StatTile label="Drafts" value={drafts} />
          </dl>
          <ul className="mt-4 divide-y divide-border">
            {activity.ideas.map((idea) => (
              <li key={idea.id} className="py-2.5">
                <Link
                  href={`/parent/children/${childId}/ideas/${idea.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md hover:bg-muted"
                >
                  <span className="min-w-0 font-semibold text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline">{idea.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {idea.status === "ready" ? "Idea created" : "Draft"} · started {dateFormat.format(new Date(idea.created_at))} · updated{" "}
                    {dateFormat.format(new Date(idea.updated_at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function SimulationsPanel({ activity, childId }: { activity: ChildActivity; childId: string }) {
  return (
    <Panel icon={ChartLine} tone="bg-mint-soft" title="Simulations">
      {activity.simulationsStarted === 0 ? (
        <EmptyNote>No simulations played yet. Results from the Startup Simulator appear here.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <StatTile label="Completed" value={activity.simulationsCompleted} tone="bg-mint-soft" />
            <StatTile label="In progress" value={activity.simulationsStarted - activity.simulationsCompleted} />
          </dl>
          <ul className="mt-4 divide-y divide-border">
            {activity.recentSimulations.map((s) => (
              <li key={s.id} className="py-2.5">
                {s.status === "completed" ? (
                  <Link
                    href={`/parent/children/${childId}/simulations/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md hover:bg-muted"
                  >
                    <span className="min-w-0 font-semibold text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline">{s.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.profit !== null && s.profit < 0 ? "Loss" : "Profit"} {s.profit?.toLocaleString("en")} FB · {s.unitsSold} sold ·{" "}
                      {dateFormat.format(new Date(s.date))}
                    </span>
                  </Link>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{s.name}</span>
                    <span className="text-sm text-muted-foreground">In progress · started {dateFormat.format(new Date(s.date))}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Founder Bucks (FB) are pretend, virtual units used for learning.</p>
        </>
      )}
    </Panel>
  );
}

const pitchStateLabel = { draft: "Draft", completed: "Completed", revising: "Revising" } as const;

export function PitchesPanel({ activity, childId }: { activity: ChildActivity; childId: string }) {
  const { pitch } = activity;
  return (
    <Panel icon={Presentation} tone="bg-sky-soft" title="Pitches & Investor Room">
      {pitch.pitchesCreated === 0 ? (
        <EmptyNote>No pitches created yet. Pitches your child builds in Pitch Studio, and their Investor Room practice, appear here.</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <StatTile label="Pitches created" value={pitch.pitchesCreated} />
            <StatTile label="Completed" value={pitch.pitchesCompleted} tone="bg-sky-soft" />
            <StatTile label="Practices" value={pitch.practicesCompleted} tone="bg-grape-soft" />
          </dl>
          <h3 className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">Recent pitch activity</h3>
          <ul className="mt-1 divide-y divide-border">
            {pitch.recent.map((p) => {
              const detail = [
                pitchStateLabel[p.state] + (p.latestVersion ? ` (v${p.latestVersion})` : ""),
                p.practices ? `${p.practices} practice${p.practices === 1 ? "" : "s"}, best ${p.bestScore}/100` : null,
                dateFormat.format(new Date(p.updatedAt)),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={p.deckId} className="py-2.5">
                  {p.latestVersion ? (
                    <Link
                      href={`/parent/children/${childId}/pitches/${p.deckId}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md hover:bg-muted"
                    >
                      <span className="min-w-0 font-semibold text-ink underline-offset-4 [overflow-wrap:anywhere] hover:underline">{p.title}</span>
                      <span className="text-sm text-muted-foreground">{detail}</span>
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{p.title}</span>
                      <span className="text-sm text-muted-foreground">{detail}</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Investor Room scores are practice feedback from pretend investors, worked out with fixed rules. No real investors are involved.
          </p>
        </>
      )}
    </Panel>
  );
}

export function AchievementsPanel({ activity }: { activity: ChildActivity }) {
  return (
    <Panel icon={Award} tone="bg-rose-soft" title="Achievements">
      {activity.achievements.length === 0 ? (
        <EmptyNote>No achievements earned yet. Badges appear here as your child completes lessons and quizzes.</EmptyNote>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {activity.achievements.map((a) => (
            <li
              key={a.key}
              title={`Earned ${dateFormat.format(new Date(a.earned_at))}`}
              className="rounded-full border-2 border-ink bg-rose-soft px-3 py-1 text-sm font-semibold text-ink"
            >
              {a.title}
            </li>
          ))}
        </ul>
      )}
      {activity.certificates.map((c) => (
        <div key={c.title} className="mt-4 flex items-start gap-3 rounded-lg bg-sun-soft px-4 py-3">
          <ScrollText className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
          <p className="text-sm text-ink">
            <span className="font-bold">{c.title}</span> · {dateFormat.format(new Date(c.issued_at))}
            <span className="block text-ink/70">A learning milestone inside Little Founders, not a formal qualification.</span>
          </p>
        </div>
      ))}
    </Panel>
  );
}
