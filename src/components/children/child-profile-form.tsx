"use client";

import { useActionState } from "react";

import { createChildAction, updateChildAction } from "@/app/(account)/actions";
import { FounderAvatar } from "@/components/illustrations/founder-avatar";
import { Alert } from "@/components/ui/alert";
import { FieldError } from "@/components/ui/form";
import { SubmitButton, TextField } from "@/components/ui/form-controls";
import { avatarKeys, avatarLabels } from "@/content/avatars";
import { initialFormState } from "@/lib/validation";

type Defaults = { childId?: string; nickname?: string; ageBand?: string; avatarKey?: string };

export function ChildProfileForm({ mode, defaults = {} }: { mode: "create" | "edit"; defaults?: Defaults }) {
  const [state, action] = useActionState(mode === "create" ? createChildAction : updateChildAction, initialFormState);
  const values = { ...defaults, ...state.values };
  const e = state.fieldErrors ?? {};
  const selectedAvatar = values.avatarKey || "founder-1";

  return (
    <form action={action} className="space-y-7" noValidate>
      {state.message ? <Alert tone="error">{state.message}</Alert> : null}
      {defaults.childId ? <input type="hidden" name="childId" value={defaults.childId} /> : null}

      <TextField
        label="Nickname"
        name="nickname"
        required
        maxLength={20}
        autoComplete="off"
        defaultValue={values.nickname}
        hint="A first name or fun nickname. Please don't use a full name."
        error={e.nickname}
      />

      <fieldset aria-describedby={e.ageBand ? "ageBand-error" : undefined}>
        <legend className="text-sm font-semibold text-ink">Age range</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[
            ["10-11", "10–11 years"],
            ["12-13", "12–13 years"],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-border bg-surface px-4 py-3 font-semibold text-ink has-[:checked]:border-ink has-[:checked]:bg-sun-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="ageBand"
                value={value}
                defaultChecked={values.ageBand === value}
                className="size-4 accent-ink"
              />
              {label}
            </label>
          ))}
        </div>
        {e.ageBand ? <FieldError id="ageBand-error" className="mt-1.5">{e.ageBand}</FieldError> : null}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Avatar</legend>
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {avatarKeys.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-transparent p-2 has-[:checked]:border-ink has-[:checked]:bg-surface has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="avatarKey"
                value={key}
                defaultChecked={selectedAvatar === key}
                className="sr-only"
              />
              <FounderAvatar avatarKey={key} className="size-14" />
              <span className="text-xs font-semibold text-ink">{avatarLabels[key]}</span>
            </label>
          ))}
        </div>
        {e.avatarKey ? <FieldError className="mt-1.5">{e.avatarKey}</FieldError> : null}
      </fieldset>

      <SubmitButton pendingLabel="Saving…">{mode === "create" ? "Create profile" : "Save changes"}</SubmitButton>
    </form>
  );
}
