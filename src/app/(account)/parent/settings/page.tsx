import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { restoreChildAction } from "@/app/(account)/actions";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ChangePinForm, DisplayNameSettingsForm } from "@/components/settings/settings-forms";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/form-controls";
import { requireParent } from "@/lib/auth/session";
import { listRemovedChildren } from "@/lib/data/children";

export const metadata: Metadata = { title: "Settings" };

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-ink bg-surface p-6">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

async function Content() {
  const ctx = await requireParent();
  const removed = await listRemovedChildren();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Settings</h1>

      <Card title="Your account" description={`Signed in as ${ctx.email}`}>
        <DisplayNameSettingsForm defaultValue={ctx.displayName} />
      </Card>

      <Card
        title="Parent PIN"
        description="Needed to leave Child Mode. Forgot it? Sign out and sign back in with your password from the PIN screen."
      >
        <ChangePinForm />
      </Card>

      <Card
        title="Removed profiles"
        description="Removed profiles are permanently deleted 30 days after removal. Restore one before then to keep it."
      >
        {removed.length === 0 ? (
          <p className="text-muted-foreground">No removed profiles.</p>
        ) : (
          <ul className="divide-y divide-border">
            {removed.map((child) => {
              const purgeOn = new Date(new Date(child.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000);
              return (
                <li key={child.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{child.nickname}</p>
                    <p className="text-sm text-muted-foreground">Will be deleted on {dateFormat.format(purgeOn)}</p>
                  </div>
                  <form action={restoreChildAction}>
                    <input type="hidden" name="childId" value={child.id} />
                    <SubmitButton size="sm" variant="secondary" pendingLabel="Restoring…">
                      Restore<span className="sr-only"> {child.nickname}</span>
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Sign out">
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" size="sm">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </form>
      </Card>
    </div>
  );
}
