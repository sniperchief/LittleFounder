import { avatarLabels, isAvatarKey, type AvatarKey } from "@/content/avatars";
import { cn } from "@/lib/utils";

// Six friendly "buddy" avatars for child profiles. No photos are ever used.

const palette: Record<AvatarKey, { bg: string; face: string }> = {
  "founder-1": { bg: "var(--sun-soft)", face: "var(--sun)" },
  "founder-2": { bg: "var(--coral-soft)", face: "var(--coral)" },
  "founder-3": { bg: "var(--sky-soft)", face: "var(--sky)" },
  "founder-4": { bg: "var(--mint-soft)", face: "var(--mint)" },
  "founder-5": { bg: "var(--grape-soft)", face: "var(--grape)" },
  "founder-6": { bg: "var(--rose-soft)", face: "var(--rose)" },
};

const s = { stroke: "var(--ink)", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function FounderAvatar({
  avatarKey,
  className,
  title,
}: {
  avatarKey: string;
  className?: string;
  /** Accessible name; omit when a visible label is next to the avatar. */
  title?: string;
}) {
  const key: AvatarKey = isAvatarKey(avatarKey) ? avatarKey : "founder-1";
  const colors = palette[key];
  return (
    <svg
      viewBox="0 0 96 96"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-16 shrink-0", className)}
    >
      <circle cx="48" cy="48" r="45" fill={colors.bg} {...s} />
      {/* accessories behind the head */}
      {key === "founder-2" ? <path d="M22 50c0-16 11-28 26-28s26 12 26 28" fill="none" {...s} strokeWidth={5} /> : null}
      {key === "founder-3" ? (
        <>
          <path d="M48 26V14" {...s} />
          <circle cx="48" cy="12" r="5" fill="var(--sun)" {...s} />
        </>
      ) : null}
      {/* head */}
      <rect x="24" y="26" width="48" height="46" rx={key === "founder-3" ? 12 : 23} fill={colors.face} {...s} />
      {/* accessories on top */}
      {key === "founder-1" ? (
        <>
          <path d="M48 26v-8" {...s} />
          <path d="M48 19c0-5 4-8 9-8 0 5-4 8-9 8Z" fill="var(--mint)" {...s} strokeWidth={2.5} />
          <path d="M48 21c0-4-3-7-7-7 0 4 3 7 7 7Z" fill="var(--mint)" {...s} strokeWidth={2.5} />
        </>
      ) : null}
      {key === "founder-2" ? (
        <>
          <rect x="15" y="44" width="10" height="16" rx="5" fill="var(--ink)" />
          <rect x="71" y="44" width="10" height="16" rx="5" fill="var(--ink)" />
        </>
      ) : null}
      {key === "founder-5" ? (
        <path d="m48 10 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z" fill="var(--sun)" {...s} strokeWidth={2.5} />
      ) : null}
      {key === "founder-6" ? (
        <path d="M48 28l-12-7v14Zm0 0 12-7v14Z" fill="var(--sun)" {...s} strokeWidth={2.5} />
      ) : null}
      {/* face */}
      {key === "founder-4" ? (
        <>
          <circle cx="39" cy="47" r="7" fill="#fff" {...s} strokeWidth={2.5} />
          <circle cx="57" cy="47" r="7" fill="#fff" {...s} strokeWidth={2.5} />
          <path d="M46 47h4" {...s} strokeWidth={2.5} />
        </>
      ) : null}
      <circle cx="39" cy="47" r="3" fill="var(--ink)" />
      <circle cx="57" cy="47" r="3" fill="var(--ink)" />
      <circle cx="33" cy="57" r="3.5" fill="#fff" opacity="0.45" />
      <circle cx="63" cy="57" r="3.5" fill="#fff" opacity="0.45" />
      <path d="M40 58c4 4 12 4 16 0" fill="none" {...s} />
    </svg>
  );
}

export { avatarLabels };
