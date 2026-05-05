"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";
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
    <nav className="flex h-full flex-col">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center gap-3 border-b border-white/8 px-4"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 ring-1 ring-amber-400/30">
          <Trophy className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold tracking-wide text-white">
            Palaro Bayugan Command
          </span>
          <span className="truncate text-[10px] tracking-wide text-white/40">
            Palarong Pambansa
          </span>
        </div>
      </Link>

      <div className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section, sectionIdx) => {
          const visibleItems = section.items.filter((item) =>
            canSeeNavItem(role, item),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label ?? `section-${sectionIdx}`} className="px-3 py-2">
              {section.label ? (
                <div className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  {section.label}
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <li key={item.href} className="relative">
                      {isActive && (
                        <span className="absolute left-0 top-0 h-full w-0.5 rounded-full bg-amber-400" />
                      )}
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                          isActive
                            ? "bg-white/8 text-white"
                            : "text-white/55 hover:bg-white/5 hover:text-white/90",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            isActive
                              ? "text-amber-400"
                              : "text-white/40 group-hover:text-white/70",
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
