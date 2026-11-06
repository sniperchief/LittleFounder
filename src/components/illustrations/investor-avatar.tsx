import { cn } from "@/lib/utils";

// Friendly, made-up investor characters for the Investor Room (PRODUCT_SPEC.md §2.4).

export type InvestorKey = "penny" | "captain" | "ivy" | "sam";

type Look = { bg: string; skin: string; hair: string };

const looks: Record<InvestorKey, Look> = {
  penny: { bg: "var(--grape-soft)", skin: "#8d5a3b", hair: "#2b1d16" },
  captain: { bg: "var(--sky-soft)", skin: "#f1c7a3", hair: "#c4622d" },
  ivy: { bg: "var(--mint-soft)", skin: "#c68b5e", hair: "#1f1a2e" },
  sam: { bg: "var(--sun-soft)", skin: "#e0ac7e", hair: "#6b6b6b" },
};

const stroke = { stroke: "var(--ink)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function InvestorAvatar({ investor, className }: { investor: InvestorKey; className?: string }) {
  const look = looks[investor];
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className={cn("size-16", className)}>
      <circle cx="40" cy="40" r="38" fill={look.bg} {...stroke} />
      {/* shoulders */}
      <path d="M16 74c3-12 12-18 24-18s21 6 24 18" fill="#fff" {...stroke} />
      {/* back hair */}
      {investor === "ivy" ? <circle cx="40" cy="15" r="8" fill={look.hair} {...stroke} /> : null}
      {investor === "penny" ? <path d="M22 44c-4-18 6-28 18-28s22 10 18 28" fill={look.hair} {...stroke} /> : null}
      {/* face */}
      <circle cx="40" cy="38" r="15" fill={look.skin} {...stroke} />
      {/* hair / hats */}
      {investor === "penny" ? <path d="M26 33c4-8 9-10 14-10s11 3 14 10c-8-2-18-2-28 0Z" fill={look.hair} {...stroke} /> : null}
      {investor === "captain" ? (
        <>
          <path d="M24 32c0-9 7-13 16-13s16 4 16 13Z" fill="var(--coral)" {...stroke} />
          <path d="M40 32h22" {...stroke} />
        </>
      ) : null}
      {investor === "ivy" ? <path d="M26 33c2-7 7-10 14-10s12 3 14 10c-4-3-9-4-14-4s-10 1-14 4Z" fill={look.hair} {...stroke} /> : null}
      {investor === "sam" ? (
        <>
          <path d="M27 31c3-6 8-8 13-8s10 2 13 8" fill="none" {...stroke} stroke={look.hair} strokeWidth={4} />
          <path d="M30 45c3 6 7 8 10 8s7-2 10-8" fill={look.hair} {...stroke} />
        </>
      ) : null}
      {/* eyes */}
      {investor === "penny" ? (
        <>
          <circle cx="34" cy="38" r="4.5" fill="#fff" {...stroke} strokeWidth={2} />
          <circle cx="46" cy="38" r="4.5" fill="#fff" {...stroke} strokeWidth={2} />
          <path d="M38.5 38h3" {...stroke} strokeWidth={2} />
        </>
      ) : null}
      {investor === "ivy" ? <path d="M28 35h24" stroke="var(--sun)" strokeWidth="4" strokeLinecap="round" /> : null}
      <circle cx="34" cy="38" r="1.8" fill="var(--ink)" />
      <circle cx="46" cy="38" r="1.8" fill="var(--ink)" />
      {/* smile */}
      {investor !== "sam" ? <path d="M35 44c2.5 2.5 7.5 2.5 10 0" fill="none" {...stroke} strokeWidth={2.2} /> : null}
    </svg>
  );
}
