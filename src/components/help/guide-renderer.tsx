import { CheckCircle2, Info, Lightbulb, AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GuideSection, ModuleGuide } from "@/lib/help-content";
import { ROLE_LABELS, rolesWithAnyPermission } from "@/lib/permissions";

interface Props {
  guide: ModuleGuide;
}

export function GuideRenderer({ guide }: Props) {
  const Icon = guide.icon;
  const creators = guide.createPermissions
    ? rolesWithAnyPermission(guide.createPermissions)
    : [];
  return (
    <article className="space-y-8">
      <header className="space-y-2 border-b pb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted p-2">
            <Icon className="size-5 text-foreground" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {guide.category}
          </p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{guide.title}</h1>
        <p className="text-sm text-muted-foreground">{guide.summary}</p>
      </header>

      {creators.length > 0 ? (
        <section
          aria-label="Who can create records in this module"
          className="rounded-md border border-emerald-200/60 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30"
        >
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="size-3.5" />
            Who can add records
          </p>
          <div className="flex flex-wrap gap-1.5">
            {creators.map((role) => (
              <Badge
                key={role}
                variant={role === "super_admin" ? "default" : "secondary"}
                className="text-[11px] font-normal"
              >
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <nav
        aria-label="On this page"
        className="rounded-md border bg-muted/30 p-4 print:hidden"
      >
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          On this page
        </p>
        <ul className="space-y-1 text-sm">
          {guide.sections.map((section, i) => (
            <li key={i}>
              <a
                href={`#section-${i}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {guide.sections.map((section, i) => (
        <Section key={i} id={`section-${i}`} section={section} />
      ))}
    </article>
  );
}

function Section({ id, section }: { id: string; section: GuideSection }) {
  const bodyParas = Array.isArray(section.body)
    ? section.body
    : section.body
      ? [section.body]
      : [];

  return (
    <section id={id} className="space-y-4 break-inside-avoid">
      <h2 className="text-lg font-semibold">{section.heading}</h2>

      {bodyParas.map((para, i) => (
        <p key={i} className="text-sm leading-relaxed text-foreground">
          {para}
        </p>
      ))}

      {section.steps && section.steps.length > 0 ? (
        <ol className="space-y-3">
          {section.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono font-semibold">
                {i + 1}
              </span>
              <div className="space-y-1 pt-0.5">
                <p className="text-sm leading-relaxed text-foreground">
                  {step.text}
                </p>
                {step.note ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    {step.note}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {section.tips && section.tips.length > 0 ? (
        <div className="space-y-2 rounded-md border border-blue-200/60 bg-blue-50/60 p-3 text-sm dark:border-blue-900/40 dark:bg-blue-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
            <Lightbulb className="size-3.5" />
            Tips
          </p>
          <ul className="space-y-1.5">
            {section.tips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-blue-900 dark:text-blue-100"
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 opacity-70" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.warnings && section.warnings.length > 0 ? (
        <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300">
            <AlertTriangle className="size-3.5" />
            Watch for
          </p>
          <ul className="space-y-1.5">
            {section.warnings.map((w, i) => (
              <li
                key={i}
                className="text-amber-900 dark:text-amber-100"
              >
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
