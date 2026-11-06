// One-click demo accounts (see src/app/(auth)/demo-actions.ts). Server-only flag; the parent PIN
// of every demo account is this fixed value so evaluators can leave Child Mode. Each demo account
// is a separate, fictional family, so sharing the PIN exposes nothing.

export const DEMO_PIN = "2580";
export const DEMO_LIFETIME_HOURS = 48;

export const demoAccountsEnabled = () => process.env.DEMO_ACCOUNTS_ENABLED === "true";
