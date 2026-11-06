"use client";

import { useActionState } from "react";

import { enableAnchoringAction } from "@/app/(account)/parent/children/[childId]/credentials/actions";
import { Alert } from "@/components/ui/alert";
import { CheckboxField, SubmitButton, TextField } from "@/components/ui/form-controls";
import { initialFormState } from "@/lib/validation";

/** Explicit, separate opt-in to anonymous public proofs. Never pre-ticked. */
export function AnchoringConsentForm({ childId, nickname }: { childId: string; nickname: string }) {
  const [state, action] = useActionState(enableAnchoringAction, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="childId" value={childId} />
      {state.message && state.status === "error" ? <Alert tone="error">{state.message}</Alert> : null}
      <CheckboxField name="public" error={e.public}>
        I understand that an anonymous proof of {nickname}&apos;s learning milestones will be recorded on Base Sepolia, a public
        blockchain test network, where <strong>anyone can see it and it may be permanent</strong>.
      </CheckboxField>
      <CheckboxField name="anonymous" error={e.anonymous}>
        I understand the proof contains <strong>no personal information</strong>: no name, nickname, age, answers or pitch content —
        only a scrambled code that can&apos;t be traced back to {nickname} without Little Founders&apos; private records.
      </CheckboxField>
      <CheckboxField name="withdraw" error={e.withdraw}>
        I understand I can turn this off at any time to stop new proofs, but that turning it off <strong>can&apos;t erase</strong> a
        proof that has already been recorded.
      </CheckboxField>
      <TextField
        label="Type your full name to confirm"
        name="typedName"
        autoComplete="name"
        defaultValue={state.values?.typedName}
        maxLength={120}
        required
        error={e.typedName}
      />
      <SubmitButton pendingLabel="Saving…">Turn on public proofs</SubmitButton>
    </form>
  );
}
