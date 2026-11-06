import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function AuthCard({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-surface p-6 shadow-[var(--shadow-sticker-lg)] sm:p-8">
      <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
      {description ? <p className="mt-2 text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{isSupabaseConfigured() ? children : <SetupNotice />}</div>
    </div>
  );
}

function SetupNotice() {
  return (
    <Alert tone="warning" title="Accounts aren't configured yet">
      This copy of LITTLE FOUNDERS isn&apos;t connected to Supabase. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
      <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code> (see the README), then restart.
    </Alert>
  );
}

export function PreviewDataNotice() {
  return (
    <Alert tone="warning" title="Preview: fictional details only">
      Accounts are open for testing while our privacy and legal review is completed. Please use a fictional nickname
      for any child profile.
    </Alert>
  );
}
