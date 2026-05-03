"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { PatientFormDialog } from "./patient-form-dialog";
import { PatientDetailDialog } from "./patient-detail-dialog";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Patient = Database["palaro"]["Tables"]["clinic_patients"]["Row"];
type Visit = Database["palaro"]["Tables"]["clinic_visits"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  patients: Patient[];
  visits: Visit[];
  delegations: Delegation[];
  clinicSites: Site[];
}

export function PatientsTable({
  patients,
  visits,
  delegations,
  clinicSites,
}: Props) {
  const [activePatient, setActivePatient] = useState<Patient | null>(null);

  const delegationMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);

  const visitsByPatient = useMemo(() => {
    const m = new Map<string, Visit[]>();
    for (const v of visits) {
      const arr = m.get(v.patient_id) ?? [];
      arr.push(v);
      m.set(v.patient_id, arr);
    }
    return m;
  }, [visits]);

  const columns: DataTableColumn<Patient>[] = [
    {
      id: "patient_number",
      header: "PT #",
      className: "font-mono text-xs",
      cell: (p) => p.patient_number,
    },
    {
      id: "full_name",
      header: "Name",
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-medium">{p.full_name}</span>
          {p.age || p.gender ? (
            <span className="text-xs text-muted-foreground">
              {[p.age ? `${p.age} y/o` : null, p.gender]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "delegation",
      header: "Delegation",
      cell: (p) =>
        p.delegation_id ? (
          delegationMap.get(p.delegation_id) ?? "—"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "visits",
      header: "Visits",
      cell: (p) => visitsByPatient.get(p.id)?.length ?? 0,
    },
    {
      id: "created",
      header: "Created",
      cell: (p) => (
        <span className="font-mono text-xs">
          {formatManila(p.created_at, "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12",
      cell: (p) => (
        <PatientFormDialog
          delegations={delegations}
          patient={p}
          trigger={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit patient"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="size-3.5" />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={patients}
        columns={columns}
        rowKey={(p) => p.id}
        pageSize={20}
        searchable={{
          placeholder: "Search by name or PT #…",
          predicate: (p, q) =>
            p.full_name.toLowerCase().includes(q) ||
            p.patient_number.toLowerCase().includes(q),
        }}
        onRowClick={(p) => setActivePatient(p)}
        empty={{
          title: "No patients yet",
          description: "Add the first patient to start logging visits.",
        }}
      />
      {activePatient ? (
        <PatientDetailDialog
          open
          patient={activePatient}
          visits={visitsByPatient.get(activePatient.id) ?? []}
          clinicSites={clinicSites}
          delegations={delegations}
          onOpenChange={(o) => (o ? null : setActivePatient(null))}
        />
      ) : null}
    </>
  );
}
