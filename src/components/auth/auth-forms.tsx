"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  forgotPasswordAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, SubmitButton, TextField } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, initialFormState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Almost there">
          {state.message}
        </Alert>
        <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-4">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        error={state.fieldErrors?.password}
      />
      <CheckboxField name="adult" error={state.fieldErrors?.adult}>
        I&apos;m 18 or over and I&apos;m setting this up as a parent or legal guardian.
      </CheckboxField>
      <SubmitButton className="w-full" pendingLabel="Creating account…">
        Create parent account
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SignInForm({ next, resetPin, linkError }: { next?: string; resetPin?: boolean; linkError?: boolean }) {
  const [state, action] = useActionState(signInAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {resetPin ? (
        <Alert tone="info" title="Forgot your parent PIN?">
          Sign in with your password to prove it&apos;s you. You&apos;ll then choose a new PIN.
        </Alert>
      ) : null}
      {linkError ? (
        <Alert tone="error">That link didn&apos;t work or has expired. Please sign in, or request a new link.</Alert>
      ) : null}
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <input type="hidden" name="next" value={next ?? ""} />
      {resetPin ? <input type="hidden" name="reset_pin" value="1" /> : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Link href="/forgot-password" className="font-semibold text-ink underline underline-offset-4">
          Forgot your password?
        </Link>
        <p>
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-ink underline underline-offset-4">
            Create a parent account
          </Link>
        </p>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialFormState);
  if (state.status === "success") return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
        error={state.fieldErrors?.password}
      />
      <TextField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full">Update password</SubmitButton>
    </form>
  );
}
