"use client";

import { useActionState } from "react";

import { recordConsentAction, saveDisplayNameAction, setPinAction } from "@/app/(account)/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, SubmitButton, TextField } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

export function DisplayNameForm({ defaultValue }: { defaultValue?: string }) {
  const [state, action] = useActionState(saveDisplayNameAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label="What should we call you?"
        name="displayName"
        autoComplete="given-name"
        defaultValue={defaultValue}
        required
        maxLength={80}
        hint="Shown only to you, in the parent area."
        error={state.fieldErrors?.displayName}
      />
      <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
    </form>
  );
}

export function ConsentForm() {
  const [state, action] = useActionState(recordConsentAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <CheckboxField name="guardian" error={e.guardian}>
        I&apos;m the parent or legal guardian of any child I add, and I&apos;m 18 or over.
      </CheckboxField>
      <CheckboxField name="notice" error={e.notice}>
        I&apos;ve read what LITTLE FOUNDERS stores and why (above), and I agree to it being used to run the service
        for my child.
      </CheckboxField>
      <CheckboxField name="preview" error={e.preview}>
        I understand this is a preview and I&apos;ll use a fictional nickname for any child profile.
      </CheckboxField>
      <TextField
        label="Type your full name to confirm"
        name="typedName"
        autoComplete="name"
        required
        defaultValue={state.values?.typedName}
        error={e.typedName}
      />
      <SubmitButton pendingLabel="Saving…">I agree — continue</SubmitButton>
    </form>
  );
}

export function PinSetupForm() {
  const [state, action] = useActionState(setPinAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="New PIN"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          pattern="[0-9]*"
          maxLength={6}
          required
          hint="4 to 6 digits."
          error={state.fieldErrors?.pin}
        />
        <TextField
          label="Confirm PIN"
          name="confirmPin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          pattern="[0-9]*"
          maxLength={6}
          required
          error={state.fieldErrors?.confirmPin}
        />
      </div>
      <SubmitButton pendingLabel="Saving…">Save PIN and finish</SubmitButton>
    </form>
  );
}
