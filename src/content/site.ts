// Site-wide navigation and copy constants for the public experience.

export const siteName = "LITTLE FOUNDERS";

export const siteDescription =
  "An entrepreneurship learning platform for children aged 10–13. Spot problems, shape ideas, run a pretend business and practise pitching — with parents in charge.";

export const landingNav = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#academy", label: "Academy" },
  { href: "/#build", label: "Build & pitch" },
  { href: "/#parents", label: "For parents" },
  { href: "/#passport", label: "Passport" },
] as const;

/** Name of the fictional in-app currency used by the Startup Simulator. */
export const virtualCurrency = { name: "Founder Bucks", symbol: "FB" } as const;
