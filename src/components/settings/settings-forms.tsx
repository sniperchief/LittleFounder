"use client";

import { useActionState } from "react";

import { changePinAction, saveDisplayNameAction } from "@/app/(account)/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton, TextField } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

export function DisplayNameSettingsForm({ defaultValue }: { defaultValue: string }) {
  const [state, action] = useActionState(saveDisplayNameAction, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="from" value="settings" />
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      {state.message && state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label="Your name"
        name="displayName"
        defaultValue={defaultValue}
        required
        maxLength={80}
        error={state.fieldErrors?.displayName}
      />
      <SubmitButton size="sm" variant="secondary">
        Save name
      </SubmitButton>
    </form>
  );
}

export function ChangePinForm() {
  const [state, action] = useActionState(changePinAction, initialFormState);
  const e = state.fieldErrors ?? {};
  const pinProps = {
    type: "password",
    inputMode: "numeric",
    pattern: "[0-9]*",
    maxLength: 6,
    required: true,
  } as const;
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
      {state.message && state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField label="Current PIN" name="currentPin" autoComplete="current-password" error={e.currentPin} {...pinProps} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="New PIN" name="pin" autoComplete="new-password" hint="4 to 6 digits." error={e.pin} {...pinProps} />
        <TextField label="Confirm new PIN" name="confirmPin" autoComplete="new-password" error={e.confirmPin} {...pinProps} />
      </div>
      <SubmitButton size="sm" variant="secondary">
        Change PIN
      </SubmitButton>
    </form>
  );
}
