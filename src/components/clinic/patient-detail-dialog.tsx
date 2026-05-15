"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogVisitDialog } from "./log-visit-dialog";
import { PatientFormDialog } from "./patient-form-dialog";
import { TimelineLog } from "@/components/shared/timeline-log";
import { formatManila } from "@/lib/timezone";
import type { Database, Json } from "@/types/database";

type Patient = Database["palaro"]["Tables"]["clinic_patients"]["Row"];
type Visit = Database["palaro"]["Tables"]["clinic_visits"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

interface Props {
  open: boolean;
  patient: Patient;
  visits: Visit[];
  clinicSites: Site[];
  delegations: Delegation[];
  onOpenChange: (open: boolean) => void;
}

function formatVitals(v: Json | null): string | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const parts: string[] = [];
  const obj = v as Record<string, unknown>;
  if (obj.bp) parts.push(`BP ${obj.bp}`);
  if (obj.hr) parts.push(`HR ${obj.hr}`);
  if (obj.temp_c) parts.push(`Temp ${obj.temp_c}°C`);
  if (obj.spo2) parts.push(`SpO₂ ${obj.spo2}%`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function PatientDetailDialog({
  open,
  patient,
  visits,
  clinicSites,
  delegations,
  onOpenChange,
}: Props) {
  const timeline = visits.map((v) => ({
    id: v.id,
    at: v.visit_date,
    title: (
      <span className="font-medium">{v.chief_complaint ?? "Visit"}</span>
    ),
    description: (
      <div className="space-y-0.5">
        {v.diagnosis ? (
          <div>
            <span className="text-muted-foreground">Dx:</span> {v.diagnosis}
          </div>
        ) : null}
        {v.prescription ? (
          <div>
            <span className="text-muted-foreground">Rx:</span> {v.prescription}
          </div>
        ) : null}
        {formatVitals(v.vital_signs) ? (
          <div className="font-mono text-[11px]">
            {formatVitals(v.vital_signs)}
          </div>
        ) : null}
      </div>
    ),
  }));

  const delegationLabel = patient.delegation_id
    ? delegations.find((d) => d.id === patient.delegation_id)?.region_code
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{patient.full_name}</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{patient.patient_number}</span>
            {patient.age || patient.gender ? (
              <>
                {" · "}
                {[patient.age ? `${patient.age} y/o` : null, patient.gender]
                  .filter(Boolean)
                  .join(" · ")}
              </>
            ) : null}
            {delegationLabel ? ` · ${delegationLabel}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" value={patient.phone} />
          <Field
            label="Emergency contact"
            value={patient.emergency_contact}
          />
          <Field label="Allergies" value={patient.allergies} wide />
          <Field
            label="Medical history"
            value={patient.medical_history}
            wide
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Visit history ({visits.length})
            </h3>
            <LogVisitDialog
              patients={[
                {
                  id: patient.id,
                  full_name: patient.full_name,
                  patient_number: patient.patient_number,
                  medical_history: patient.medical_history,
                },
              ]}
              clinicSites={clinicSites}
              patientId={patient.id}
            />
          </div>
          {visits.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              No visits yet for this patient.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border p-3">
              <TimelineLog
                entries={timeline}
                empty="No visits recorded yet."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <PatientFormDialog
            delegations={delegations}
            patient={patient}
            trigger={<Button variant="outline">Edit patient</Button>}
          />
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">
        {value ? (
          value
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

// formatManila reference kept implicit via TimelineLog's own formatter.
// Imported here only to satisfy the build if relocated later.
void formatManila;
