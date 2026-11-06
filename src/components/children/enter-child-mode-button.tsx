import { Sparkles } from "lucide-react";

import { enterChildModeAction } from "@/app/(account)/actions";
import { SubmitButton } from "@/components/ui/form-controls";
import type { ButtonProps } from "@/components/ui/button";

export function EnterChildModeButton({
  childId,
  nickname,
  variant = "accent",
  size = "sm",
  className,
}: {
  childId: string;
  nickname: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  return (
    <form action={enterChildModeAction} className={className}>
      <input type="hidden" name="childId" value={childId} />
      <SubmitButton variant={variant} size={size} className="w-full" pendingLabel="Starting…">
        <Sparkles aria-hidden="true" /> Start Child Mode<span className="sr-only"> for {nickname}</span>
      </SubmitButton>
    </form>
  );
}
