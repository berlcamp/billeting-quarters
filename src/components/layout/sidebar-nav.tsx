"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { canSeeNavItem, NAV_SECTIONS } from "./nav-config";
import type { UserRole } from "@/lib/permissions";

interface SidebarNavProps {
  role: UserRole | null;
  onNavigate?: () => void;
}

export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 p-3">
      <div className="px-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex flex-col leading-tight"
        >
          <span className="text-lg font-bold tracking-tight">Palaro Command</span>
          <span className="text-xs text-muted-foreground">
            Palarong Pambansa
          </span>
        </Link>
      </div>

      {NAV_SECTIONS.map((section, sectionIdx) => {
        const visibleItems = section.items.filter((item) =>
          canSeeNavItem(role, item),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label ?? `section-${sectionIdx}`} className="space-y-1">
            {section.label ? (
              <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
