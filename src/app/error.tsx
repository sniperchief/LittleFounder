"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

import { StatusPanel } from "@/components/layout/status-panel";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex-1">
      <StatusPanel
        title="Oops — something went wrong"
        description="That wasn’t supposed to happen. Please try again in a moment."
        actions={
          <>
            <Button onClick={() => retry()}>Try again</Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              Go to the home page
            </Link>
          </>
        }
      />
    </main>
  );
}
