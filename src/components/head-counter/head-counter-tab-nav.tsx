"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type HeadCounterTab = "bq" | "venue";

interface TabOption {
  value: HeadCounterTab;
  label: string;
}

interface Props {
  active: HeadCounterTab;
  options: TabOption[];
}

// URL-driven tabs. Switching writes `?tab=<value>` so the server component
// re-renders with the matching data set (BQ delegations or playing venues).
// Other params (`date`, `delegation`, `site`) survive the switch so the
// user's date selection isn't lost.
export function HeadCounterTabNav({ active, options }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: HeadCounterTab) {
    if (next === active) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", next);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-lg border bg-muted/40 p-1"
    >
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => go(opt.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
