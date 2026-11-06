import { Lock } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";

// Child Mode shell. No parent links, account details or sign-out here:
// the only way back to the parent area is the PIN screen at /play/exit.
export default function ChildModeLayout({ children }: LayoutProps<"/play">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[radial-gradient(circle_at_1px_1px,rgb(26_27_58/0.07)_1px,transparent_0)] [background-size:22px_22px]">
      <header className="border-b-2 border-ink bg-sun">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/play" className="flex items-center gap-2 rounded-lg font-display text-lg font-extrabold text-ink">
            <LogoMark className="size-9" />
            <span>
              Founder <span className="hidden min-[360px]:inline">HQ</span>
            </span>
          </Link>
          <Link
            href="/play/exit"
            className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-4 py-1.5 text-sm font-bold text-ink hover:bg-muted"
          >
            <Lock className="size-4" aria-hidden="true" /> Grown-ups
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
