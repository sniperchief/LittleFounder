import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";

const footerLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#parents", label: "For parents" },
  { href: "/privacy", label: "Our privacy approach" },
  { href: "/get-started", label: "Get started" },
];

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-surface">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-muted-foreground">
            Entrepreneurship learning for curious 10–13 year olds, with parents in charge.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4 md:grid-cols-2">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="font-semibold text-ink underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 LITTLE FOUNDERS. Early preview.</p>
          <p>No ads. No chat. No public child profiles.</p>
        </Container>
      </div>
    </footer>
  );
}
