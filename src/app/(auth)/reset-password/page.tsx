import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the password-reset email (the callback signs the parent in first).
// The proxy redirects signed-out visitors to /sign-in, and the action re-checks the session.
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
