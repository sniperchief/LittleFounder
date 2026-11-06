"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { landingNav } from "@/content/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-full border-2 border-ink bg-surface text-ink"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open ? (
        <nav
          id={panelId}
          aria-label="Main"
          className="absolute inset-x-0 top-16 border-b-2 border-ink bg-background px-4 pb-6 pt-2 shadow-[var(--shadow-soft)] sm:px-6"
        >
          <ul className="flex flex-col">
            {landingNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-lg font-semibold text-ink hover:bg-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/get-started"
            onClick={() => setOpen(false)}
            className={buttonVariants({ className: "mt-4 w-full" })}
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            onClick={() => setOpen(false)}
            className={buttonVariants({ variant: "secondary", className: "mt-3 w-full" })}
          >
            Sign in
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
