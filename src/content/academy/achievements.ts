import type { AchievementContent, CertificateContent } from "./types";

// Founder Passport badges (Academy, Idea Lab, Simulator, Pitch Studio). Every rule is evaluated in the database from stored,
// server-verified activity (public.evaluate_achievements) — never from client claims.
// Module badges are generated from each module's `badge` (see index.ts).
export const extraAchievements: AchievementContent[] = [
  {
    key: "first-steps",
    title: "First Steps",
    description: "Completed your first Founder Academy lesson.",
    icon: "footprints",
    tier: 1,
    rule: { type: "lessons_completed", count: 1 },
  },
  {
    key: "steady-learner",
    title: "Steady Learner",
    description: "Completed 5 lessons.",
    icon: "book-open",
    tier: 1,
    rule: { type: "lessons_completed", count: 5 },
  },
  {
    key: "quiz-whiz",
    title: "Quiz Whiz",
    description: "Scored 100% on a module quiz.",
    icon: "star",
    tier: 2,
    rule: { type: "perfect_quiz" },
  },
  {
    key: "idea-spark",
    title: "Idea Spark",
    description: "Created your first business idea in the Idea Lab.",
    icon: "lightbulb",
    tier: 1,
    rule: { type: "ideas_created", count: 1 },
  },
  {
    key: "first-business-run",
    title: "First Business Run",
    description: "Completed your first Startup Simulator challenge.",
    icon: "trending-up",
    tier: 1,
    rule: { type: "simulations_completed", count: 1 },
  },
  {
    key: "first-pitch",
    title: "First Pitch",
    description: "Finished your first pitch in Pitch Studio.",
    icon: "presentation",
    tier: 1,
    rule: { type: "pitches_completed", count: 1 },
  },
  {
    key: "confident-founder",
    title: "Confident Founder",
    description: "Completed your first Investor Room practice.",
    icon: "mic",
    tier: 2,
    rule: { type: "practices_completed", count: 1 },
  },
  {
    key: "halfway-hero",
    title: "Halfway Hero",
    description: "Completed 3 Academy modules.",
    icon: "flag",
    tier: 2,
    rule: { type: "modules_completed", count: 3 },
  },
  {
    key: "academy-graduate",
    title: "Academy Graduate",
    description: "Completed all six Founder Academy modules.",
    icon: "graduation-cap",
    tier: 3,
    rule: { type: "modules_completed", count: 6 },
  },
];

// A learning milestone — not a formal educational qualification.
export const certificates: CertificateContent[] = [
  {
    key: "founder-academy-milestone",
    title: "Founder Academy Learning Milestone",
    requirement: { type: "modules_completed", count: 6 },
  },
];
