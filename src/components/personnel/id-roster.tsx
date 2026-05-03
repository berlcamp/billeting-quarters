"use client";

import { useMemo, useState } from "react";
import { Printer, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintButton } from "@/components/reports/print-button";
import { IdCard } from "./id-card";
import { ROLE_LABELS, type UserRole } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

interface Props {
  profiles: Profile[];
}

const ALL_ROLES = "all";

export function IdRoster({ profiles }: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | typeof ALL_ROLES>(
    ALL_ROLES,
  );

  const roles = useMemo(() => {
    const set = new Set<UserRole>();
    for (const p of profiles) if (p.role) set.add(p.role as UserRole);
    return Array.from(set).sort();
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== ALL_ROLES && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (p.full_name?.toLowerCase().includes(q) ?? false) ||
        p.email.toLowerCase().includes(q) ||
        (p.agency?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [profiles, query, roleFilter]);

  return (
    <div className="space-y-4">
      {/* Filter / print toolbar — hidden on print */}
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, agency…"
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(v) =>
              setRoleFilter((v ?? ALL_ROLES) as typeof roleFilter)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === ALL_ROLES) return "All roles";
                  return ROLE_LABELS[v as UserRole];
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES}>All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {filtered.length} card{filtered.length === 1 ? "" : "s"}
          </span>
          <PrintButton>
            <Printer className="size-4" />
            Print IDs
          </PrintButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground print:hidden">
          No personnel match that filter.
        </div>
      ) : (
        // Each personnel = front + back as a back-to-back pair. On screen we
        // show 2 pairs per row (so 4 cards) at lg, 1 pair per row otherwise.
        // On print we force 1 pair per row so each printed page is one set of
        // back-to-back cards aligned for folding/duplex.
        <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-1 print:gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-2 gap-2 break-inside-avoid"
            >
              <IdCard profile={p} side="front" />
              <IdCard profile={p} side="back" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
