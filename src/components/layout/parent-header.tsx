import { LogOut, Sparkles } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/settings", label: "Settings" },
] as const;

export function ParentHeader() {
  return (
    <header className="border-b-2 border-ink bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground md:inline">
            Parent area
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <nav aria-label="Parent" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link href="/profiles" className={cn(buttonVariants({ variant: "accent", size: "sm" }))}>
            <Sparkles aria-hidden="true" /> <span className="hidden min-[400px]:inline">Child Mode</span>
            <span className="min-[400px]:hidden">Kids</span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex size-9 items-center justify-center rounded-full text-ink hover:bg-muted"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
      <nav aria-label="Parent" className="border-t border-border sm:hidden">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4 py-2">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-ink"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
