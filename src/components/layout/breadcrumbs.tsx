"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

function titleize(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return (
      <span className="text-sm font-medium text-foreground">Command Center</span>
    );
  }

  // Drop the leading "dashboard" segment from rendering — the topbar already lives in /dashboard
  const visible = segments[0] === "dashboard" ? segments.slice(1) : segments;
  const basePrefix = segments[0] === "dashboard" ? "/dashboard" : "";

  const items = visible.map((segment, idx) => ({
    segment,
    href: `${basePrefix}/${visible.slice(0, idx + 1).join("/")}`,
  }));

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/dashboard" className="hover:text-foreground">
        Dashboard
      </Link>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={item.href}>
            <ChevronRight className="size-3.5 shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground">
                {titleize(item.segment)}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-foreground">
                {titleize(item.segment)}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
