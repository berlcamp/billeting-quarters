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
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];

interface Props {
  personnel: Personnel[];
}

const ALL_COMMITTEES = "all";

export function IdRoster({ personnel }: Props) {
  const [query, setQuery] = useState("");
  const [committee, setCommittee] = useState<string>(ALL_COMMITTEES);

  const committees = useMemo(() => {
    const set = new Set<string>();
    for (const p of personnel) if (p.committee) set.add(p.committee);
    return Array.from(set).sort();
  }, [personnel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personnel.filter((p) => {
      if (committee !== ALL_COMMITTEES && p.committee !== committee)
        return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.committee.toLowerCase().includes(q) ||
        (p.designation?.toLowerCase().includes(q) ?? false) ||
        (p.agency?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [personnel, query, committee]);

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
              placeholder="Search name, committee, agency…"
              className="pl-9"
            />
          </div>
          <Select
            value={committee}
            onValueChange={(v) => setCommittee(v ?? ALL_COMMITTEES)}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === ALL_COMMITTEES) return "All committees";
                  return v;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_COMMITTEES}>All committees</SelectItem>
              {committees.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
              <IdCard personnel={p} side="front" />
              <IdCard personnel={p} side="back" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
