// Startup Simulator model and content (Phase 5). Rules: docs/STARTUP_SIMULATOR.md.
//
// The numbers are seeded into public.simulator_scenarios.demand_params by
// `npm run content:seed`; the database function public.simulator_outcome() is the only
// place results are calculated. `estimateCosts` below is a display-only preview.
//
// Founder Bucks (FB) are pretend, virtual units for learning. They are not real money,
// cryptocurrency or redeemable rewards. Keep this file free of imports (Node loads it).

export type MarketingOption = {
  key: string;
  label: string;
  cost: number;
  /** Extra interested customers this option brings (fixed, not random). */
  reach: number;
  description: string;
};

export type SimulatorModel = {
  startingBudget: number;
  unitCost: number;
  prices: number[];
  /** Interested customers at each price, before marketing. */
  interestedAtPrice: Record<string, number>;
  quantities: number[];
  marketing: MarketingOption[];
};

export const simulatorModel: SimulatorModel = {
  startingBudget: 1000,
  unitCost: 4,
  prices: [6, 8, 10, 12, 15],
  interestedAtPrice: { "6": 160, "8": 130, "10": 100, "12": 70, "15": 40 },
  quantities: [50, 100, 150, 200, 250],
  marketing: [
    { key: "none", label: "No marketing", cost: 0, reach: 0, description: "Keep all your Founder Bucks for making bottles." },
    { key: "posters", label: "Posters around town", cost: 50, reach: 20, description: "Cheap, and a few more people hear about you." },
    { key: "fair-stall", label: "Stall at the school fair", cost: 100, reach: 45, description: "Lots of families walk past your stall." },
    { key: "radio", label: "Local radio shout-out", cost: 200, reach: 80, description: "Reaches the most people, but costs the most." },
  ],
};

export type ScenarioContent = {
  key: string;
  title: string;
  product: string;
  productPlural: string;
  intro: string;
  /** "my-idea" runs the same practice numbers for one of the child's own Idea Lab ideas. */
  usesIdea: boolean;
};

export const scenarios: ScenarioContent[] = [
  {
    key: "ecobottle",
    title: "EcoBottle",
    product: "reusable water bottle",
    productPlural: "bottles",
    intro:
      "EcoBottle is a pretend business that sells reusable water bottles to help people use less single-use plastic. You're in charge for one selling season!",
    usesIdea: false,
  },
  {
    key: "my-idea",
    title: "My idea",
    product: "product",
    productPlural: "items",
    intro:
      "Try your own Idea Lab idea with practice numbers. They're the same pretend numbers as EcoBottle — not a real estimate for your idea.",
    usesIdea: true,
  },
];

export const reflectionOptions = [
  { key: "price", label: "I'd change my price" },
  { key: "quantity", label: "I'd make a different number" },
  { key: "marketing", label: "I'd choose different marketing" },
  { key: "same", label: "I'd keep the same plan" },
] as const;

/** Child-friendly explanations for the feedback keys the database returns. */
export const feedbackText: Record<string, string> = {
  profit: "Your business made a profit: more Founder Bucks came in from sales than you spent.",
  loss: "Your business made a loss: you spent more Founder Bucks than came back in from sales.",
  "break-even": "Your business broke even: sales covered your costs exactly.",
  "sold-out": "You sold out! More customers wanted one than you made — you could have sold more.",
  leftover: "Some were left over. Making things nobody buys still costs money.",
  "price-low": "Your price was low: lots of buyers, but you earned less from each one.",
  "price-high": "Your price was high: you earned more from each one, but fewer people bought.",
  "marketing-paid-off": "Your marketing paid off: the extra sales earned more than it cost.",
  "marketing-not-worth-it": "Your marketing cost more than the extra sales it brought in this time.",
};

export const tryNextText: Record<string, string> = {
  "sold-out": "Try making more so you don't miss customers.",
  leftover: "Try making fewer, or bring in more customers with marketing.",
  "price-low": "Try a slightly higher price and see what happens to your profit.",
  "price-high": "Try a lower price so more people can afford it.",
  "marketing-not-worth-it": "Try a cheaper marketing option, or none at all.",
  loss: "Try spending less on things that don't get sold.",
};

/** Display-only cost preview. The real result always comes from the database. */
export function estimateCosts(model: SimulatorModel, quantity: number | null, marketingKey: string | null) {
  const production = (quantity ?? 0) * model.unitCost;
  const marketing = model.marketing.find((m) => m.key === marketingKey)?.cost ?? 0;
  const total = production + marketing;
  return { production, marketing, total, left: model.startingBudget - total, overBudget: total > model.startingBudget };
}
