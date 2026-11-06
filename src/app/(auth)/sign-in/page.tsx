import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthCard title="Welcome back" description="Sign in to your parent account.">
      <Suspense fallback={<SignInForm />}>
        <SignInFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignInFormWithParams({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return <SignInForm next={next} resetPin={params.reset_pin === "1"} linkError={params.error === "link"} />;
}
