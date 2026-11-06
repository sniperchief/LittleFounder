// Idea Lab guidance and preset choices. Public content (no answer keys): used by the
// wizard in the browser and by server-side validation. The database enforces the same
// value lists in supabase/migrations/20261106000800_idea_lab.sql — keep them in sync.

export const ideaLimits = {
  name: 40,
  problem: 200,
  problemWho: 120,
  solution: 240,
  solutionBenefit: 160,
  customerNote: 160,
  valueStatement: 160,
  maxActiveIdeas: 10,
} as const;

export type ProblemCategory = { key: string; label: string; emoji: string; prompts: string[] };

export const problemCategories: ProblemCategory[] = [
  {
    key: "school",
    label: "School supplies",
    emoji: "✏️",
    prompts: [
      "Pencils and pens go missing all the time",
      "School bags are too heavy to carry",
      "It's hard to remember which books to bring each day",
      "Lunch gets squashed in my bag",
    ],
  },
  {
    key: "organisation",
    label: "Getting organised",
    emoji: "🗂️",
    prompts: [
      "Homework deadlines are easy to forget",
      "My desk gets messy and I can't find things",
      "Mornings are rushed and we're often late",
      "Chargers and cables get tangled and lost",
    ],
  },
  {
    key: "hobbies",
    label: "Hobbies & sport",
    emoji: "⚽",
    prompts: [
      "Sports kit is muddy and smelly after practice",
      "Craft supplies are messy and hard to store",
      "It's hard to find people to practise music with",
      "Board game pieces keep getting lost",
    ],
  },
  {
    key: "pets",
    label: "Pets & animals",
    emoji: "🐾",
    prompts: [
      "Pets get bored when everyone is out",
      "It's easy to forget if the pet has been fed",
      "Families need help with pets when they go away",
      "Garden birds have nowhere to drink in hot weather",
    ],
  },
  {
    key: "environment",
    label: "The environment",
    emoji: "🌱",
    prompts: [
      "Lots of plastic gets thrown away at school",
      "People forget to switch off lights and screens",
      "Litter collects in the local park",
      "Old toys and clothes end up in the bin",
    ],
  },
  {
    key: "home",
    label: "Home & chores",
    emoji: "🏠",
    prompts: [
      "Chores aren't shared fairly at home",
      "Plants die when nobody remembers to water them",
      "Keys and glasses keep getting lost",
      "Younger siblings get bored on rainy days",
    ],
  },
];

export const problemFrequencies = [
  { key: "daily", label: "Every day" },
  { key: "weekly", label: "Every week" },
  { key: "monthly", label: "Every month" },
  { key: "sometimes", label: "Now and then" },
] as const;

export const solutionTypes = [
  { key: "product", label: "A thing you make", example: "a bottle clip, a storage box, a reminder chart" },
  { key: "service", label: "A service you do", example: "pet sitting, plant watering, bike cleaning" },
  { key: "digital", label: "A digital tool", example: "a printable planner, a simple game, a checklist" },
  { key: "event", label: "An event or club", example: "a swap day, a litter-pick club, a craft workshop" },
] as const;

export const customerTags = [
  { key: "kids", label: "Kids" },
  { key: "teens", label: "Teenagers" },
  { key: "parents", label: "Parents & carers" },
  { key: "grandparents", label: "Grandparents" },
  { key: "teachers", label: "Teachers" },
  { key: "pet-owners", label: "Pet owners" },
  { key: "families", label: "Families" },
  { key: "neighbours", label: "Neighbours" },
  { key: "sports-teams", label: "Sports teams & clubs" },
  { key: "small-businesses", label: "Small local businesses" },
] as const;

export const buyers = [
  { key: "users", label: "The people who use it", hint: "Like teenagers buying their own phone case." },
  { key: "parents", label: "Parents or carers", hint: "Like a parent buying a lunch box for their child." },
  { key: "schools", label: "A school or club", hint: "Like a school buying recycling bins for every class." },
  { key: "businesses", label: "A local business", hint: "Like a café paying for a poster that brings in customers." },
  { key: "free", label: "Nobody — it's free", hint: "A sponsor, charity or volunteers could cover the costs." },
] as const;

export const specialTags = [
  { key: "cheaper", label: "Cheaper" },
  { key: "faster", label: "Faster" },
  { key: "easier", label: "Easier to use" },
  { key: "eco-friendly", label: "Kinder to the planet" },
  { key: "more-fun", label: "More fun" },
  { key: "safer", label: "Safer" },
  { key: "healthier", label: "Healthier" },
  { key: "kinder", label: "Helps people be kind" },
] as const;

export const firstSteps = [
  { key: "ask-people", label: "Ask 5 people if they have the problem" },
  { key: "sketch", label: "Draw a sketch of my idea" },
  { key: "prototype", label: "Build a cardboard prototype" },
  { key: "test-friends", label: "Let a few friends try it" },
  { key: "work-out-costs", label: "Work out what it would cost" },
] as const;

export const ideaIcons = [
  "lightbulb", "rocket", "leaf", "paw", "book", "palette", "bike", "recycle", "heart", "star", "music", "house",
] as const;

export type IdeaIconKey = (typeof ideaIcons)[number];

export const ideaSteps = [
  { key: "problem", title: "Find a problem", short: "Problem" },
  { key: "solution", title: "Create a solution", short: "Solution" },
  { key: "customers", title: "Identify your customers", short: "Customers" },
  { key: "name", title: "Choose a name", short: "Name" },
  { key: "describe", title: "Describe your idea", short: "Describe" },
  { key: "review", title: "Review your idea", short: "Review" },
] as const;

/** Academy lessons that teach each part of an idea (shown in the workspace). */
export const ideaConcepts = [
  { step: "Problem", module: "think-like-a-founder", lesson: "spotting-problems", title: "Be a problem detective" },
  { step: "Problem", module: "think-like-a-founder", lesson: "problems-to-opportunities", title: "From problem to opportunity" },
  { step: "Solution", module: "create-your-idea", lesson: "choose-the-best-idea", title: "Choose an idea that fits" },
  { step: "Solution", module: "create-your-idea", lesson: "build-a-prototype", title: "Build a quick prototype" },
  { step: "Customers", module: "know-your-customers", lesson: "who-is-your-customer", title: "Who is your customer?" },
  { step: "Customers", module: "know-your-customers", lesson: "ask-good-questions", title: "Ask good questions" },
  { step: "Next steps", module: "understand-business", lesson: "setting-a-price", title: "Setting a price" },
  { step: "Next steps", module: "pitch-your-idea", lesson: "parts-of-a-pitch", title: "The parts of a pitch" },
] as const;

export const labelOf = <T extends { key: string; label: string }>(list: readonly T[], key: string | null | undefined) =>
  list.find((x) => x.key === key)?.label ?? null;

/**
 * Gentle privacy nudge (never blocks): spots things that look like personal details.
 * Children are reminded that founders keep personal info private.
 */
export function privacyNudge(text: string): string | null {
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return "That looks like an email address — founders keep personal details private!";
  if (/(\+?\d[\s-]?){7,}/.test(text)) return "That looks like a phone number — founders keep personal details private!";
  if (/\bhttps?:\/\/|www\./i.test(text)) return "Links aren't needed here — just describe your idea in your own words.";
  if (/\b\d{1,4}\s+\w+\s+(street|st|road|rd|avenue|ave|lane|close|drive)\b/i.test(text))
    return "That looks like an address — founders keep personal details private!";
  return null;
}
