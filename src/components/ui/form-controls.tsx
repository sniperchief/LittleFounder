"use client";

import { LoaderCircle } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Submit button that shows a pending state while its form's action runs. */
export function SubmitButton({ children, pendingLabel, className, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} className={className} {...props}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

/** Labelled input with hint and error wired up via aria-describedby. */
export function TextField({
  label,
  hint,
  error,
  className,
  ...inputProps
}: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

/** Large tickable checkbox row for confirmations. */
export function CheckboxField({
  name,
  children,
  error,
  defaultChecked,
}: {
  name: string;
  children: ReactNode;
  error?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-2 border-ink accent-ink"
        />
        <label htmlFor={id} className="cursor-pointer leading-relaxed text-ink">
          {children}
        </label>
      </div>
      {error ? (
        <FieldError id={`${id}-error`} className="pl-8">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}
