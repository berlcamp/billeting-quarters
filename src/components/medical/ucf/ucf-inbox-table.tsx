"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LiveBadge } from "@/components/shared/live-badge";
import { useRealtimeReferrals } from "@/lib/hooks/use-realtime-referrals";
import {
  PATIENT_GENDER_LABELS,
  type PatientGender,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface UcfInboxTableProps {
  referrals: Referral[];
  siteLookup: Map<string, string>;
  delegationLookup: Map<string, { code: string; name: string }>;
}

type TabKey = "pending" | "in_treatment" | "discharged";

const TAB_STATUS: Record<TabKey, readonly string[]> = {
  pending: ["pending"],
  in_treatment: ["accepted", "in_treatment"],
  discharged: ["discharged", "admitted", "rejected"],
};

export function UcfInboxTable({
  referrals: initial,
  siteLookup,
  delegationLookup,
}: UcfInboxTableProps) {
  const [tab, setTab] = useState<TabKey>("pending");
  const router = useRouter();
  const referrals = useRealtimeReferrals(initial);

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { pending: 0, in_treatment: 0, discharged: 0 };
    for (const r of referrals) {
      if (r.level !== "field_to_ucf") continue;
      for (const k of Object.keys(TAB_STATUS) as TabKey[]) {
        if ((TAB_STATUS[k] as readonly string[]).includes(r.status)) c[k]++;
      }
    }
    return c;
  }, [referrals]);

  const filtered = useMemo(() => {
    const allowed = TAB_STATUS[tab];
    const list = referrals.filter(
      (r) => r.level === "field_to_ucf" && allowed.includes(r.status),
    );
    // Pending: oldest first (urgency). Others: most recent activity first.
    return tab === "pending"
      ? [...list].sort((a, b) => a.referred_at.localeCompare(b.referred_at))
      : [...list].sort((a, b) => b.referred_at.localeCompare(a.referred_at));
  }, [referrals, tab]);

  const columns: DataTableColumn<Referral>[] = [
    {
      id: "patient",
      header: "Patient",
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.patient_name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.patient_age != null ? `${row.patient_age}y` : ""}
            {row.patient_age != null && row.patient_gender ? " · " : ""}
            {row.patient_gender
              ? PATIENT_GENDER_LABELS[row.patient_gender as PatientGender]
              : ""}
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
      id: "from",
      header: "Referring site",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.from_site_id ? (siteLookup.get(row.from_site_id) ?? "—") : "—"}
        </span>
      ),
    },
    {
      id: "ucf",
      header: "UCF",
      className: "w-40",
      cell: (row) => (
        <span className="text-sm">
          {siteLookup.get(row.to_site_id) ?? "—"}
        </span>
      ),
    },
    {
      id: "wait",
      header: tab === "pending" ? "Waiting" : "Sent",
      className: "w-32",
      cell: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {tab === "pending"
            ? formatDistanceToNow(new Date(row.referred_at), { addSuffix: true })
            : format(new Date(row.referred_at), "MMM d, HH:mm")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      className: "w-32",
      cell: (row) => <StatusBadge variant="referral" status={row.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="in_treatment">
              In treatment ({counts.in_treatment})
            </TabsTrigger>
            <TabsTrigger value="discharged">
              Discharged ({counts.discharged})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <LiveBadge label="Live" />
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search patient or referral #…",
          predicate: (row, q) =>
            row.patient_name.toLowerCase().includes(q) ||
            row.referral_number.toLowerCase().includes(q) ||
            (row.chief_complaint ?? "").toLowerCase().includes(q),
        }}
        empty={{
          title:
            tab === "pending"
              ? "No pending referrals"
              : tab === "in_treatment"
                ? "Nothing in treatment"
                : "No discharged cases yet",
          description:
            tab === "pending"
              ? "Field referrals will appear here as they arrive."
              : undefined,
        }}
        onRowClick={(row) => router.push(`/dashboard/medical/ucf/${row.id}`)}
      />
    </div>
  );
}
