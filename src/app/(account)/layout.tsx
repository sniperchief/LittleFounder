import { ParentHeader } from "@/components/layout/parent-header";

// Parent area: onboarding, profile picker, dashboard, settings.
// Each page guards itself on the server (requireAdult / requireParent), and those
// guards send anyone in Child Mode back to /play — the parent PIN is the only way out.
export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ParentHeader />
      <main id="main" className="flex-1 bg-background">
        {children}
      </main>
    </>
  );
}
