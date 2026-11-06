// Founder Academy curriculum (source of truth). Read by scripts/generate-seed.mjs.
// Not imported by the app: lessons are served from the database without answer keys.
// To add a lesson or question: edit the module file, run `npm run content:seed`,
// then `npm run db:push` (and `npm run db:check`).
import type { AchievementContent, AcademyModuleContent } from "./types";

import thinkLikeAFounder from "./01-think-like-a-founder.ts";
import createYourIdea from "./02-create-your-idea.ts";
import knowYourCustomers from "./03-know-your-customers.ts";
import understandBusiness from "./04-understand-business.ts";
import pitchYourIdea from "./05-pitch-your-idea.ts";
import meetTheInvestors from "./06-meet-the-investors.ts";
import { certificates, extraAchievements } from "./achievements.ts";

export const academy: AcademyModuleContent[] = [
  thinkLikeAFounder,
  createYourIdea,
  knowYourCustomers,
  understandBusiness,
  pitchYourIdea,
  meetTheInvestors,
];

export const achievements: AchievementContent[] = [
  ...extraAchievements.filter((a) => a.rule.type === "lessons_completed"),
  ...academy.map(
    (m): AchievementContent => ({
      key: m.badge.key,
      title: m.badge.title,
      description: m.badge.description,
      icon: m.icon,
      tier: 2,
      rule: { type: "module_completed", module: m.key },
    }),
  ),
  ...extraAchievements.filter((a) => a.rule.type !== "lessons_completed"),
];

export { certificates };
