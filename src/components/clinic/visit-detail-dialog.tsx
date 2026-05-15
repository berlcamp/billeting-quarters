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
import { formatManila } from "@/lib/timezone";
import type { Database, Json } from "@/types/database";

type Visit = Database["palaro"]["Tables"]["clinic_visits"]["Row"];
type Patient = Pick<
  Database["palaro"]["Tables"]["clinic_patients"]["Row"],
  "id" | "full_name" | "patient_number"
>;
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  open: boolean;
  visit: Visit;
  patient: Patient | null;
  site: Site | null;
  onOpenChange: (open: boolean) => void;
}

function vitalRows(v: Json | null): { label: string; value: string }[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const obj = v as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  if (obj.bp) rows.push({ label: "BP", value: String(obj.bp) });
  if (obj.hr) rows.push({ label: "HR", value: `${obj.hr} bpm` });
  if (obj.temp_c) rows.push({ label: "Temp", value: `${obj.temp_c} °C` });
  if (obj.rr) rows.push({ label: "RR", value: String(obj.rr) });
  if (obj.spo2) rows.push({ label: "SpO₂", value: `${obj.spo2}%` });
  if (obj.weight_kg)
    rows.push({ label: "Weight", value: `${obj.weight_kg} kg` });
  if (obj.height_cm)
    rows.push({ label: "Height", value: `${obj.height_cm} cm` });
  return rows;
}

export function VisitDetailDialog({
  open,
  visit,
  patient,
  site,
  onOpenChange,
}: Props) {
  const vitals = vitalRows(visit.vital_signs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {patient?.full_name ?? "Unknown patient"}
          </DialogTitle>
          <DialogDescription>
            {patient?.patient_number ? (
              <span className="font-mono">{patient.patient_number}</span>
            ) : null}
            {patient?.patient_number ? " · " : null}
            <span className="font-mono">
              {formatManila(visit.visit_date, "MMM d, yyyy · HH:mm")}
            </span>
            {site?.name ? ` · ${site.name}` : null}
          </DialogDescription>
        </DialogHeader>

        {vitals.length > 0 ? (
          <fieldset className="rounded-md border p-3">
            <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vitals
            </legend>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              {vitals.map((r) => (
                <div key={r.label} className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {r.label}
                  </span>
                  <span className="font-mono text-sm">{r.value}</span>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Chief complaint" value={visit.chief_complaint} wide />
          <Field label="Diagnosis" value={visit.diagnosis} wide />
          <Field label="Prescription" value={visit.prescription} wide />
          <Field label="Notes" value={visit.notes} wide />
        </div>

        <DialogFooter>
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
      <div className="whitespace-pre-wrap text-sm">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
