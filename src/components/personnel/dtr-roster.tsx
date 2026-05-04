"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DtrSheet } from "./dtr-sheet";
import { manilaDateLabel } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];
type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];

interface Props {
  personnel: Personnel[];
  logs: AttendanceLog[];
  from: string; // YYYY-MM-DD (Asia/Manila)
  to: string; // YYYY-MM-DD inclusive
}

const ALL_COMMITTEES = "all";

// Build the inclusive list of YYYY-MM-DD days from `from` to `to` in Manila.
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  // Anchor at noon UTC of each day to avoid DST/timezone drift.
  let cur = Date.UTC(fy, fm - 1, fd, 12);
  const end = Date.UTC(ty, tm - 1, td, 12);
  while (cur <= end) {
    const d = new Date(cur);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
    cur += 24 * 60 * 60 * 1000;
  }
  return out;
}

export function DtrRoster({ personnel, logs, from, to }: Props) {
  const router = useRouter();
  const [pendingNav, startNav] = useTransition();
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);
  const [query, setQuery] = useState("");
  const [committeeFilter, setCommitteeFilter] = useState<string>(ALL_COMMITTEES);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const days = useMemo(() => daysBetween(from, to), [from, to]);
  const periodLabel = useMemo(
    () =>
      from === to
        ? manilaDateLabel(from)
        : `${manilaDateLabel(from)} — ${manilaDateLabel(to)}`,
    [from, to],
  );

  const committees = useMemo(() => {
    const set = new Set<string>();
    for (const p of personnel) if (p.committee) set.add(p.committee);
    return Array.from(set).sort();
  }, [personnel]);

  // Pre-bucket logs by personnel so each sheet only iterates its own slice.
  const logsByPersonnel = useMemo(() => {
    const m = new Map<string, AttendanceLog[]>();
    for (const log of logs) {
      const arr = m.get(log.personnel_id) ?? [];
      arr.push(log);
      m.set(log.personnel_id, arr);
    }
    return m;
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personnel.filter((p) => {
      if (committeeFilter !== ALL_COMMITTEES && p.committee !== committeeFilter)
        return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.committee.toLowerCase().includes(q) ||
        (p.designation?.toLowerCase().includes(q) ?? false) ||
        (p.agency?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [personnel, query, committeeFilter]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const someFilteredSelected =
    filtered.some((p) => selected.has(p.id)) && !allFilteredSelected;

  function toggleAllFiltered(check: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) {
        for (const p of filtered) next.add(p.id);
      } else {
        for (const p of filtered) next.delete(p.id);
      }
      return next;
    });
  }

  function toggleOne(id: string, check: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyDateRange() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromInput)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(toInput)) return;
    if (fromInput === from && toInput === to) return;
    const params = new URLSearchParams({ from: fromInput, to: toInput });
    startNav(() => {
      router.replace(`/dashboard/personnel/dtr?${params.toString()}`);
    });
  }

  // Sheets to actually render. If nothing checked, show a single preview of the
  // first filtered personnel so the user can see what print output looks like;
  // otherwise render the user's selection (in their displayed order).
  const toRender =
    selected.size === 0
      ? filtered.slice(0, 1)
      : filtered.filter((p) => selected.has(p.id));

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden on print */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-3">
          <div className="space-y-1.5">
            <Label htmlFor="dtr-from">From</Label>
            <Input
              id="dtr-from"
              type="date"
              value={fromInput}
              max={toInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dtr-to">To</Label>
            <Input
              id="dtr-to"
              type="date"
              value={toInput}
              min={fromInput}
              onChange={(e) => setToInput(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="button" onClick={applyDateRange} disabled={pendingNav}>
            {pendingNav ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Apply range
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            Period: <span className="font-medium">{periodLabel}</span> ·{" "}
            {days.length} day{days.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
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
            value={committeeFilter}
            onValueChange={(v) => setCommitteeFilter(v ?? ALL_COMMITTEES)}
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

          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {selected.size} of {filtered.length} selected
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
              disabled={selected.size === 0}
            >
              <Printer className="size-4" />
              Print {selected.size > 0 ? `${selected.size} ` : ""}DTR
              {selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        {/* Selectable personnel list */}
        <div className="rounded-md border">
          <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <Checkbox
              checked={allFilteredSelected}
              indeterminate={someFilteredSelected}
              onCheckedChange={(c) => toggleAllFiltered(c === true)}
              aria-label="Select all visible"
            />
            <span>Personnel</span>
            <span className="ml-auto">Committee · Agency</span>
          </div>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No personnel match that filter.
            </div>
          ) : (
            <ul className="max-h-[360px] divide-y overflow-auto">
              {filtered.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => toggleOne(p.id, c === true)}
                      aria-label={`Select ${p.full_name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.full_name}</div>
                      {p.designation ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {p.designation}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{p.committee}</div>
                      <div className="truncate">{p.agency ?? "—"}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Preview hint */}
        <p className="text-xs text-muted-foreground">
          {selected.size === 0
            ? "Showing a preview of the first personnel. Tick rows above to include them in the print run."
            : `${selected.size} DTR sheet${selected.size === 1 ? "" : "s"} ready — each prints on its own page.`}
        </p>
      </div>

      {/* Print area — one sheet per personnel, page break after each. */}
      <div className="dtr-print-area space-y-6">
        {toRender.map((p) => (
          <div key={p.id} className="dtr-sheet-wrapper">
            <DtrSheet
              personnel={p}
              days={days}
              logs={logsByPersonnel.get(p.id) ?? []}
              periodLabel={periodLabel}
            />
          </div>
        ))}
      </div>

      {/* Print rules: one DTR per page, no app chrome. */}
      <style>{`
        .dtr-sheet-wrapper {
          break-inside: avoid;
          break-after: page;
          page-break-after: always;
        }
        .dtr-sheet-wrapper:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { background: white !important; }
          .dtr-sheet { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
