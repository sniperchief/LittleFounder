import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { siteDescription, siteName } from "@/content/site";

import "./globals.css";

// next/font self-hosts these at build time: no runtime requests to third parties.
const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `${siteName} — Big ideas start small`, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
};

export const viewport: Viewport = {
  themeColor: "#fffbf5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only rounded-full bg-ink px-5 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
