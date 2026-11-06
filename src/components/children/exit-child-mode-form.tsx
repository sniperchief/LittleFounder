"use client";

import { useActionState } from "react";

import { exitChildModeAction } from "@/app/play/actions";
import { Alert } from "@/components/ui/alert";
import { SubmitButton, TextField } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

export function ExitChildModeForm() {
  const [state, action] = useActionState(exitChildModeAction, initialFormState);
  return (
    <form action={action} className="space-y-4 text-left" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label="Parent PIN"
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={6}
        required
        className="[&_input]:text-center [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        error={state.fieldErrors?.pin}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SubmitButton name="to" value="parent" pendingLabel="Checking…">
          Parent area
        </SubmitButton>
        <SubmitButton name="to" value="profiles" variant="secondary" pendingLabel="Checking…">
          Switch founder
        </SubmitButton>
      </div>
    </form>
  );
}
