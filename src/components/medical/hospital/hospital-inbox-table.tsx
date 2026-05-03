"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LiveBadge } from "@/components/shared/live-badge";
import { useRealtimeReferrals } from "@/lib/hooks/use-realtime-referrals";
import { REFERRAL_LEVEL_LABELS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface HospitalInboxTableProps {
  referrals: Referral[];
  siteLookup: Map<string, string>;
  delegationLookup: Map<string, { code: string; name: string }>;
}

type TabKey = "pending" | "in_treatment" | "admitted" | "discharged";

const TAB_STATUS: Record<TabKey, readonly string[]> = {
  pending: ["pending", "accepted"],
  in_treatment: ["in_treatment"],
  admitted: ["admitted"],
  discharged: ["discharged", "rejected"],
};

export function HospitalInboxTable({
  referrals: initial,
  siteLookup,
  delegationLookup,
}: HospitalInboxTableProps) {
  const [tab, setTab] = useState<TabKey>("pending");
  const router = useRouter();
  const all = useRealtimeReferrals(initial);

  const hospital = useMemo(
    () =>
      all.filter(
        (r) => r.level === "ucf_to_hospital" || r.level === "hospital_admit",
      ),
    [all],
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      pending: 0,
      in_treatment: 0,
      admitted: 0,
      discharged: 0,
    };
    for (const r of hospital) {
      for (const k of Object.keys(TAB_STATUS) as TabKey[]) {
        if ((TAB_STATUS[k] as readonly string[]).includes(r.status)) c[k]++;
      }
    }
    return c;
  }, [hospital]);

  const filtered = useMemo(() => {
    const allowed = TAB_STATUS[tab];
    const list = hospital.filter((r) => allowed.includes(r.status));
    return tab === "pending"
      ? [...list].sort((a, b) => a.referred_at.localeCompare(b.referred_at))
      : [...list].sort((a, b) => b.referred_at.localeCompare(a.referred_at));
  }, [hospital, tab]);

  const columns: DataTableColumn<Referral>[] = [
    {
      id: "patient",
      header: "Patient",
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.patient_name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.patient_age != null ? `${row.patient_age}y` : "—"}
          </div>
        </div>
      ),
    },
    {
      id: "level",
      header: "Source",
      className: "w-32",
      cell: (row) => (
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider"
        >
          {row.level === "hospital_admit"
            ? "Direct admit"
            : REFERRAL_LEVEL_LABELS[row.level]}
        </Badge>
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
      header: "Diagnosis / complaint",
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-2">
          {row.initial_diagnosis ?? row.chief_complaint ?? "—"}
        </span>
      ),
    },
    {
      id: "from",
      header: "From",
      className: "w-32",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.from_site_id ? (siteLookup.get(row.from_site_id) ?? "—") : "—"}
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
            <TabsTrigger value="admitted">
              Admitted ({counts.admitted})
            </TabsTrigger>
            <TabsTrigger value="discharged">
              Discharged / rejected ({counts.discharged})
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
          placeholder: "Search patient, referral #, or diagnosis…",
          predicate: (row, q) =>
            row.patient_name.toLowerCase().includes(q) ||
            row.referral_number.toLowerCase().includes(q) ||
            (row.initial_diagnosis ?? "").toLowerCase().includes(q) ||
            (row.chief_complaint ?? "").toLowerCase().includes(q),
        }}
        empty={{
          title:
            tab === "pending"
              ? "No incoming referrals"
              : tab === "in_treatment"
                ? "Nothing in active treatment"
                : tab === "admitted"
                  ? "No admitted patients"
                  : "No completed cases",
        }}
        onRowClick={(row) => router.push(`/dashboard/medical/hospital/${row.id}`)}
      />
    </div>
  );
}
