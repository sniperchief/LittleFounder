import type { Metadata } from "next";
import { Info, Mic } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { startPracticeAction } from "@/app/play/pitch/actions";
import { BackLink, ChildPageSkeleton } from "@/components/academy/academy-ui";
import { InvestorAvatar } from "@/components/illustrations/investor-avatar";
import { investorKey, PretendInvestorLabel } from "@/components/pitch/pitch-visuals";
import { SubmitButton } from "@/components/ui/form-controls";
import { requireChildMode } from "@/lib/auth/session";
import { getPitch, listPersonas } from "@/lib/data/pitch";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Investor Room" };

const errors: Record<string, string> = {
  rate_limited: "That's a lot of practice! Take a short break and come back.",
  pitch_not_finished: "Finish your pitch first, then the pretend investors can ask you questions.",
};

export default function InvestorRoomPage(props: PageProps<"/play/pitch/[deckId]/investor">) {
  return (
    <Suspense fallback={<ChildPageSkeleton />}>
      <InvestorRoom {...props} />
    </Suspense>
  );
}

async function InvestorRoom({ params, searchParams }: PageProps<"/play/pitch/[deckId]/investor">) {
  const [{ deckId }, query, { child, supabase }] = await Promise.all([params, searchParams, requireChildMode()]);
  if (!uuidSchema.safeParse(deckId).success) notFound();
  const pitch = await getPitch(supabase, child.id, deckId);
  if (!pitch) notFound();
  const latest = pitch.versions[0];
  if (!latest) redirect(`/play/pitch/${pitch.id}/edit?step=6`);
  const personas = await listPersonas(supabase);
  const error = typeof query.error === "string" ? (errors[query.error] ?? "Something went wrong. Please try again.") : null;
  const changed = pitch.status !== "ready";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <BackLink href={`/play/pitch/${pitch.id}`}>Back to my pitch</BackLink>

      <header className="mt-5 rounded-3xl border-2 border-ink bg-grape-soft p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-3xl border-2 border-ink bg-surface">
            <Mic className="size-10 text-ink" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold text-ink">Investor Room</h1>
            <p className="mt-1 text-lg text-ink/85">
              Practise answering questions about <strong className="[overflow-wrap:anywhere]">{latest.snapshot.title}</strong>. Pick a friendly
              pretend investor — each one is curious about different things.
            </p>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-ink/85">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          These investors are made-up characters for practice. Nobody real sees your pitch, there&apos;s no real money, and your score is
          practice feedback worked out with fixed rules — just for learning.
        </p>
      </header>

      {changed ? (
        <p className="mt-6 rounded-xl bg-sky-soft px-4 py-3 text-ink">
          You&apos;ll practise with version {latest.version}, your latest finished pitch. Finish your newer changes first if you want to
          practise with those.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-coral-soft px-4 py-3 font-semibold text-ink">
          {error}
        </p>
      ) : null}

      <ul className="mt-8 grid gap-5 md:grid-cols-2">
        {personas.map((p) => (
          <li key={p.key} className="flex flex-col rounded-3xl border-2 border-ink bg-surface p-6">
            <div className="flex items-center gap-4">
              <InvestorAvatar investor={investorKey(p.key)} className="size-20 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-ink">{p.name}</h2>
                <p className="font-semibold text-ink/80">Interested in: {p.focus}</p>
                <p className="text-sm text-muted-foreground">Style: {p.style}</p>
              </div>
            </div>
            <p className="mt-3 flex-1 text-ink/85">{p.intro}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <PretendInvestorLabel />
              <form action={startPracticeAction}>
                <input type="hidden" name="deckId" value={pitch.id} />
                <input type="hidden" name="persona" value={p.key} />
                <SubmitButton pendingLabel="Opening…">
                  Practise with {p.name.split(" ")[0]}
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
