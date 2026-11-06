import { Section, SectionHeader } from "@/components/layout/container";
import { ModuleIcon } from "@/components/academy/module-visuals";
import { academyModules } from "@/content/modules";

export function AcademySection() {
  return (
    <Section id="academy" aria-labelledby="academy-title">
      <SectionHeader
        id="academy-title"
        eyebrow="Founder Academy"
        title="Six modules, from first spark to final pitch"
        description="Each module has short lessons with a hands-on activity, then a quick quiz. Lessons take just a few minutes, so learning fits around homework and play."
      />
      <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {academyModules.map((module) => {
          return (
            <li
              key={module.key}
              className="group flex flex-col rounded-xl border-2 border-ink bg-surface p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-sticker-lg)]"
            >
              <div className="flex items-center justify-between">
                <ModuleIcon icon={module.icon} tone={module.tone} />
                <span className="font-display text-4xl font-extrabold text-ink/15" aria-hidden="true">
                  {String(module.position).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Module {module.position} · {module.lessonCount} lessons + quiz
              </p>
              <h3 className="mt-1 text-xl font-bold text-ink">{module.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{module.summary}</p>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
