import { AppIcon } from "@/components/academy/module-visuals";

// Celebrates badges just earned (keys come back from the server's scoring functions).
export function BadgeList({
  badges,
  heading,
}: {
  badges: { key: string; title: string; icon: string; description: string }[];
  heading: string;
}) {
  return (
    <div className="rounded-xl border-2 border-ink bg-sun-soft p-4">
      <p className="font-display text-lg font-extrabold text-ink">{heading}</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {badges.map((b) => {
          return (
            <li key={b.key} className="flex items-center gap-3 rounded-lg bg-surface p-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-sun shadow-[var(--shadow-sticker)]">
                <AppIcon name={b.icon} className="size-6 text-ink" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-ink">{b.title}</span>
                <span className="block text-sm text-ink/75">{b.description}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm font-semibold text-ink/75">Find it in your Founder Passport.</p>
    </div>
  );
}
