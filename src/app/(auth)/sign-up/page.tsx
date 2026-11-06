import type { Metadata } from "next";

import { AuthCard, PreviewDataNotice } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";
import { DemoAccountButton } from "@/components/auth/demo-account-button";
import { demoAccountsEnabled } from "@/lib/demo";

export const metadata: Metadata = { title: "Create a parent account" };

export default function SignUpPage() {
  return (
    <div className="space-y-5">
      {demoAccountsEnabled() ? <DemoAccountButton /> : null}
      <AuthCard
        title="Create a parent account"
        description="Accounts belong to parents and guardians. Children never need their own email or password."
      >
        <SignUpForm />
      </AuthCard>
      <PreviewDataNotice />
    </div>
  );
}
