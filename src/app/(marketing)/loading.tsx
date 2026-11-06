import { LogoMark } from "@/components/brand/logo";

export default function Loading() {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 py-28">
      <LogoMark className="size-12 animate-bounce motion-reduce:animate-none" />
      <p className="font-semibold text-muted-foreground">Loading…</p>
    </div>
  );
}
