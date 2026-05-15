"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { VisitDetailDialog } from "./visit-detail-dialog";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Visit = Database["palaro"]["Tables"]["clinic_visits"]["Row"];
type Patient = Pick<
  Database["palaro"]["Tables"]["clinic_patients"]["Row"],
  "id" | "full_name" | "patient_number"
>;
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  visits: Visit[];
  patients: Patient[];
  sites: Site[];
}

export function VisitsTable({ visits, patients, sites }: Props) {
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  const patientMap = useMemo(() => {
    const m = new Map<string, Patient>();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);
  const siteMap = useMemo(() => {
    const m = new Map<string, Site>();
    for (const s of sites) m.set(s.id, s);
    return m;
  }, [sites]);

  const columns: DataTableColumn<Visit>[] = [
    {
      id: "visit_date",
      header: "Visit date",
      cell: (v) => (
        <span className="font-mono text-xs">
          {formatManila(v.visit_date, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: (v) => {
        const p = patientMap.get(v.patient_id);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{p?.full_name ?? "Unknown"}</span>
            {p?.patient_number ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                {p.patient_number}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "site",
      header: "Clinic",
      cell: (v) => siteMap.get(v.site_id)?.name ?? "—",
    },
    {
      id: "complaint",
      header: "Chief complaint",
      cell: (v) =>
        v.chief_complaint ? (
          <span className="line-clamp-1 text-sm">{v.chief_complaint}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "diagnosis",
      header: "Diagnosis",
      cell: (v) =>
        v.diagnosis ? (
          <span className="line-clamp-1 text-sm">{v.diagnosis}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        data={visits}
        columns={columns}
        rowKey={(v) => v.id}
        pageSize={20}
        searchable={{
          placeholder: "Search by patient, complaint, diagnosis…",
          predicate: (v, q) => {
            const p = patientMap.get(v.patient_id);
            return (
              (p?.full_name.toLowerCase().includes(q) ?? false) ||
              (p?.patient_number.toLowerCase().includes(q) ?? false) ||
              (v.chief_complaint?.toLowerCase().includes(q) ?? false) ||
              (v.diagnosis?.toLowerCase().includes(q) ?? false)
            );
          },
        }}
        onRowClick={(v) => setActiveVisit(v)}
        empty={{
          title: "No visits logged",
          description: "Log the first visit to start tracking clinic activity.",
        }}
      />
      {activeVisit ? (
        <VisitDetailDialog
          open
          visit={activeVisit}
          patient={patientMap.get(activeVisit.patient_id) ?? null}
          site={siteMap.get(activeVisit.site_id) ?? null}
          onOpenChange={(o) => (o ? null : setActiveVisit(null))}
        />
      ) : null}
    </>
  );
}
