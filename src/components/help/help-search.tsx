"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import {
  HELP_CATEGORIES,
  MODULE_GUIDES,
  type ModuleGuide,
} from "@/lib/help-content";

interface Props {
  // Currently signed-in user's role — drives the "for your role" section.
  // null when nothing relevant should be highlighted.
  role: UserRole | null;
}

function isRelevantTo(guide: ModuleGuide, role: UserRole | null): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  if (!guide.audience || guide.audience.length === 0) return true;
  return guide.audience.includes(role);
}

function matchesQuery(guide: ModuleGuide, q: string): boolean {
  if (!q) return true;
  const haystack = [
    guide.title,
    guide.summary,
    guide.category,
    ...guide.sections.flatMap((s) => [
      s.heading,
      ...(Array.isArray(s.body) ? s.body : s.body ? [s.body] : []),
      ...(s.steps?.map((step) => step.text) ?? []),
      ...(s.tips ?? []),
    ]),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function HelpSearch({ role }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => MODULE_GUIDES.filter((g) => matchesQuery(g, query)),
    [query],
  );

  const forYou = useMemo(
    () => filtered.filter((g) => isRelevantTo(g, role)),
    [filtered, role],
  );

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the guide…"
          className="pl-9"
          autoFocus
        />
      </div>

      {role && forYou.length > 0 && !query ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">
              For your role · {ROLE_LABELS[role]}
            </h2>
            <span className="text-xs text-muted-foreground">
              {forYou.length} guide{forYou.length === 1 ? "" : "s"}
            </span>
          </div>
          <GuideGrid guides={forYou} />
        </section>
      ) : null}

      {HELP_CATEGORIES.map((category) => {
        const inCategory = filtered.filter((g) => g.category === category);
        if (inCategory.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-lg font-semibold">{category}</h2>
            <GuideGrid guides={inCategory} />
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guides match &quot;{query}&quot;. Try a different keyword.
        </p>
      ) : null}
    </div>
  );
}

function GuideGrid({ guides }: { guides: ModuleGuide[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {guides.map((g) => {
        const Icon = g.icon;
        return (
          <Link
            key={g.slug}
            href={`/dashboard/help/${g.slug}`}
            className="group block focus:outline-none"
          >
            <Card className="h-full transition group-hover:border-foreground/30 group-hover:shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="size-4 text-muted-foreground" />
                  {g.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">
                  {g.summary}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
