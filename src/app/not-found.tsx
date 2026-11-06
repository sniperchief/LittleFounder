import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { StatusPanel } from "@/components/layout/status-panel";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <StatusPanel
          title="This page wandered off"
          description="We couldn’t find the page you were looking for. It may have moved, or the link might be mistyped."
          actions={
            <Link href="/" className={buttonVariants()}>
              Go to the home page
            </Link>
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
