import "server-only";

import { academy } from "./academy/index.ts";
import type { ModuleIcon, ModuleTone } from "./academy/types";

// Public Founder Academy outline for the landing page, derived from the curriculum
// so titles live in one place. server-only: the curriculum files contain answer keys
// and must never reach a client bundle.

export type { ModuleIcon, ModuleTone };

export type AcademyModule = {
  key: string;
  position: number;
  title: string;
  summary: string;
  icon: ModuleIcon;
  tone: ModuleTone;
  lessonCount: number;
};

export const academyModules: AcademyModule[] = academy.map((m) => ({
  key: m.key,
  position: m.position,
  title: m.title,
  summary: m.summary,
  icon: m.icon,
  tone: m.tone,
  lessonCount: m.lessons.length,
}));
