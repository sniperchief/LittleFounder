import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { buttonVariants } from "@/components/ui/button";
import { landingNav } from "@/content/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {landingNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-ink hover:bg-muted md:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/get-started" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            Get started
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
