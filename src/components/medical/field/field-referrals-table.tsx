"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ACTIVE_REFERRAL_STATUSES,
  REFERRAL_STATUS_LABELS,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface FieldReferralsTableProps {
  referrals: Referral[];
  siteLookup: Map<string, string>;
  delegationLookup: Map<string, { code: string; name: string }>;
}

type TabKey = "active" | "history";

export function FieldReferralsTable({
  referrals,
  siteLookup,
  delegationLookup,
}: FieldReferralsTableProps) {
  const [tab, setTab] = useState<TabKey>("active");

  const filtered = useMemo(() => {
    if (tab === "active") {
      const activeSet = new Set<string>(ACTIVE_REFERRAL_STATUSES);
      return referrals.filter((r) => activeSet.has(r.status));
    }
    const activeSet = new Set<string>(ACTIVE_REFERRAL_STATUSES);
    return referrals.filter((r) => !activeSet.has(r.status));
  }, [referrals, tab]);

  const columns: DataTableColumn<Referral>[] = [
    {
      id: "number",
      header: "#",
      className: "w-32 font-mono text-xs",
      cell: (row) => row.referral_number,
    },
    {
      id: "patient",
      header: "Patient",
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.patient_name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.patient_age != null ? `${row.patient_age}y` : ""}
            {row.patient_age != null && row.patient_gender ? " · " : ""}
            {row.patient_gender ?? ""}
          </div>
        </div>
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
      id: "complaint",
      header: "Chief complaint",
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.chief_complaint ?? "—"}
        </span>
      ),
    },
    {
      id: "ucf",
      header: "Target UCF",
      cell: (row) => (
        <span className="text-sm">
          {siteLookup.get(row.to_site_id) ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-32",
      cell: (row) => <StatusBadge variant="referral" status={row.status} />,
    },
    {
      id: "referred_at",
      header: "Sent",
      className: "w-32",
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(row.referred_at), "MMM d, HH:mm")}
        </span>
      ),
    },
  ];

  const activeCount = referrals.filter((r) =>
    (ACTIVE_REFERRAL_STATUSES as readonly string[]).includes(r.status),
  ).length;
  const historyCount = referrals.length - activeCount;

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="active">My active ({activeCount})</TabsTrigger>
          <TabsTrigger value="history">History ({historyCount})</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search by patient or referral #…",
          predicate: (row, q) =>
            row.patient_name.toLowerCase().includes(q) ||
            row.referral_number.toLowerCase().includes(q) ||
            (row.chief_complaint ?? "").toLowerCase().includes(q),
        }}
        empty={{
          title:
            tab === "active"
              ? "No active referrals"
              : "No referral history yet",
          description:
            tab === "active"
              ? `Statuses shown: ${ACTIVE_REFERRAL_STATUSES.map((s) => REFERRAL_STATUS_LABELS[s]).join(", ")}.`
              : "Discharged, admitted, and rejected referrals will appear here.",
        }}
      />
    </div>
  );
}
