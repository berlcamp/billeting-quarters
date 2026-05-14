"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertOctagon, Printer } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LiveBadge } from "@/components/shared/live-badge";
import { useRealtimeIncidents } from "@/lib/hooks/use-realtime-incidents";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  REFERRAL_LEVEL_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentStatus,
  type ReferralLevel,
  type ReferralStatus,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

export type IncidentReferralLookupEntry = {
  id: string;
  to_site_id: string;
  level: ReferralLevel;
  status: ReferralStatus;
  referred_at: string;
};

interface IncidentsTableProps {
  incidents: Incident[];
  siteLookup: Map<string, string>;
  delegationLookup: Map<string, { code: string; name: string }>;
  /** Latest referral per incident_id; used to show "where it was referred" for incidents in 'referred' status. */
  referralLookup?: Map<string, IncidentReferralLookupEntry>;
  /** When set, hides the category column + filter (the list is already scoped to one category). */
  lockedCategory?: IncidentCategory;
}

const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  "open",
  "in_progress",
  "referred",
  "resolved",
  "closed",
];

export function IncidentsTable({
  incidents,
  siteLookup,
  delegationLookup,
  referralLookup,
  lockedCategory,
}: IncidentsTableProps) {
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | "all">(
    "all",
  );
  const router = useRouter();

  useRealtimeIncidents({
    onCritical: (incident) => {
      toast.error(`CRITICAL: ${incident.title}`, {
        description: `Incident #${incident.incident_number} just opened.`,
        icon: <AlertOctagon className="size-4" />,
        duration: 10_000,
      });
    },
  });

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (severityFilter !== "all" && i.severity !== severityFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      return true;
    });
  }, [incidents, statusFilter, severityFilter, categoryFilter]);

  const columns: DataTableColumn<Incident>[] = [
    {
      id: "number",
      header: "#",
      className: "w-32 font-mono text-xs",
      cell: (row) => row.incident_number,
    },
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.title}</div>
          {row.affected_person_name ? (
            <div className="truncate text-xs text-muted-foreground">
              {row.affected_person_name}
              {row.affected_person_role ? ` · ${row.affected_person_role}` : ""}
            </div>
          ) : null}
        </div>
      ),
    },
    ...(lockedCategory
      ? []
      : [
          {
            id: "category",
            header: "Category",
            className: "w-28",
            cell: (row: Incident) => (
              <span className="text-sm text-muted-foreground">
                {INCIDENT_CATEGORY_LABELS[row.category]}
              </span>
            ),
          },
        ]),
    {
      id: "severity",
      header: "Severity",
      className: "w-28",
      cell: (row) => <StatusBadge variant="severity" status={row.severity} />,
    },
    {
      id: "status",
      header: "Status",
      className: "w-44",
      cell: (row) => {
        const ref = row.status === "referred" ? referralLookup?.get(row.id) : undefined;
        const destinationName = ref ? siteLookup.get(ref.to_site_id) : undefined;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge variant="incident" status={row.status} />
            {ref ? (
              <div className="text-xs text-muted-foreground leading-tight">
                <div className="truncate" title={destinationName ?? undefined}>
                  → {destinationName ?? "Unknown site"}
                </div>
                <div className="text-[10px] uppercase tracking-wide opacity-70">
                  {REFERRAL_LEVEL_LABELS[ref.level]}
                </div>
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "site",
      header: "Site",
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.site_id ? (siteLookup.get(row.site_id) ?? "—") : "—"}
        </span>
      ),
    },
    {
      id: "delegation",
      header: "Delegation",
      className: "w-28",
      cell: (row) => {
        if (!row.delegation_id) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        const d = delegationLookup.get(row.delegation_id);
        return (
          <span className="font-mono text-xs">
            {d ? d.code : row.delegation_id.slice(0, 6)}
          </span>
        );
      },
    },
    {
      id: "reported_at",
      header: "Reported",
      className: "w-36",
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(row.reported_at), "MMM d, HH:mm")}
        </span>
      ),
    },
    ...(lockedCategory === "medical"
      ? [
          {
            id: "print",
            header: "",
            className: "w-12 text-right",
            cell: (row: Incident) => (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/medical/incidents/${row.id}/print`);
                }}
                aria-label={`Print consultation/referral form for ${row.incident_number}`}
                title="Print patient consultation/referral form"
              >
                <Printer className="size-4 text-muted-foreground" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <LiveBadge label="Live" />
      </div>
      <DataTable
      data={filtered}
      columns={columns}
      rowKey={(row) => row.id}
      searchable={{
        placeholder: "Search by title or affected person…",
        predicate: (row, q) =>
          row.title.toLowerCase().includes(q) ||
          (row.affected_person_name?.toLowerCase().includes(q) ?? false),
      }}
      filters={
        <>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as IncidentStatus | "all")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                {(v: string | null) =>
                  !v || v === "all"
                    ? "All statuses"
                    : v in INCIDENT_STATUS_LABELS
                      ? INCIDENT_STATUS_LABELS[v as IncidentStatus]
                      : v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {INCIDENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {INCIDENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={severityFilter}
            onValueChange={(v) =>
              setSeverityFilter(v as IncidentSeverity | "all")
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue>
                {(v: string | null) =>
                  !v || v === "all"
                    ? "All severities"
                    : v in SEVERITY_LABELS
                      ? SEVERITY_LABELS[v as IncidentSeverity]
                      : v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockedCategory ? null : (
            <Select
              value={categoryFilter}
              onValueChange={(v) =>
                setCategoryFilter(v as IncidentCategory | "all")
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === "all"
                      ? "All categories"
                      : v in INCIDENT_CATEGORY_LABELS
                        ? INCIDENT_CATEGORY_LABELS[v as IncidentCategory]
                        : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {INCIDENT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {INCIDENT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </>
      }
      empty={{
        title: "No incidents yet",
        description: "Submit your first incident to populate this list.",
      }}
      onRowClick={(row) => router.push(`/dashboard/incidents/${row.id}`)}
      />
    </div>
  );
}
