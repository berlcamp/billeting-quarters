import Image from "next/image";
import { formatInTimeZone } from "date-fns-tz";
import { PALARO_TZ } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];
type Site = Database["palaro"]["Tables"]["sites"]["Row"];
type Delegation = Database["palaro"]["Tables"]["delegations"]["Row"];

interface Props {
  incident: Incident;
  referrals: Referral[];
  site: Site | null;
  delegation: Delegation | null;
}

const FORM_DELEGATION_OPTIONS = [
  "Athlete",
  "NTWG",
  "RTWG",
  "Coach",
  "Chaperon",
  "Utility/Driver",
] as const;
type FormDelegationOption = (typeof FORM_DELEGATION_OPTIONS)[number];

// Map our looser affected_person_role free-text into the form's fixed options.
function resolveDelegationCheck(role: string | null): {
  ticked: FormDelegationOption | null;
  others: string | null;
} {
  if (!role) return { ticked: null, others: null };
  const lc = role.trim().toLowerCase();
  const match = FORM_DELEGATION_OPTIONS.find((o) => o.toLowerCase() === lc);
  if (match) return { ticked: match, others: null };
  // Athlete / Coach / Chaperon synonyms.
  if (lc === "athlete" || lc === "player") return { ticked: "Athlete", others: null };
  if (lc === "coach") return { ticked: "Coach", others: null };
  if (lc === "chaperon" || lc === "chaperone") return { ticked: "Chaperon", others: null };
  if (lc === "driver" || lc === "utility") return { ticked: "Utility/Driver", others: null };
  return { ticked: null, others: role };
}

type VitalSigns = {
  bp?: string;
  hr?: number;
  rr?: number;
  temp?: number;
  spo2?: number;
  on_arrival?: VitalSigns;
};

// Merge vital signs across the chain, preferring the latest non-empty value.
function combineVitals(referrals: Referral[]): VitalSigns {
  const out: VitalSigns = {};
  const setIf = (key: keyof VitalSigns, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    (out as Record<string, unknown>)[key as string] = value;
  };
  for (const r of referrals) {
    const raw = r.vital_signs as VitalSigns | null;
    if (!raw) continue;
    setIf("bp", raw.bp);
    setIf("hr", raw.hr);
    setIf("rr", raw.rr);
    setIf("temp", raw.temp);
    setIf("spo2", raw.spo2);
    if (raw.on_arrival) {
      setIf("bp", raw.on_arrival.bp);
      setIf("hr", raw.on_arrival.hr);
      setIf("rr", raw.on_arrival.rr);
      setIf("temp", raw.on_arrival.temp);
      setIf("spo2", raw.on_arrival.spo2);
    }
  }
  return out;
}

function joinNonEmpty(parts: (string | null | undefined)[], sep = " · "): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(sep);
}

function Cell({
  label,
  value,
  className = "",
  minHeight = "min-h-[20px]",
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  className?: string;
  minHeight?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-1.5 py-1 ${className}`}>
      <div className="text-[8.5pt] leading-tight">{label}</div>
      {value !== undefined ? (
        <div
          className={`whitespace-pre-wrap text-[8.5pt] font-medium leading-snug ${minHeight}`}
        >
          {value}
        </div>
      ) : null}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-y border-black bg-neutral-100 px-1.5 py-0.5 text-[8.5pt] font-bold uppercase tracking-tight">
      {children}
    </div>
  );
}

function Tick({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex size-3 shrink-0 items-center justify-center border border-black text-[7.5pt] leading-none">
      {checked ? "✓" : ""}
    </span>
  );
}

export function PatientReferralForm({
  incident,
  referrals,
  site,
  delegation,
}: Props) {
  // Choose the most recent referral as the primary source of clinical fields.
  const latest = referrals.length > 0 ? referrals[referrals.length - 1] : null;
  const vitals = combineVitals(referrals);

  const patientName =
    latest?.patient_name ??
    incident.affected_person_name ??
    "";

  const ageSex = joinNonEmpty([
    incident.affected_person_age != null
      ? `${incident.affected_person_age} y/o`
      : latest?.patient_age != null
        ? `${latest.patient_age} y/o`
        : null,
    latest?.patient_gender
      ? latest.patient_gender.charAt(0).toUpperCase() +
        latest.patient_gender.slice(1)
      : null,
  ]);

  const delegationCheck = resolveDelegationCheck(incident.affected_person_role);

  // Region/Division — we only have region. "Division" is DepEd-school-division and
  // isn't part of our delegation model, so we leave it blank for manual fill-in.
  const region = delegation?.region_name ?? null;
  const placeOfIncident = joinNonEmpty(
    [site?.name ?? null, incident.location_details ?? null],
    " — ",
  );

  // Treatment / diagnosis: prefer hospital-level data if present; fall back through chain.
  const treatment = joinNonEmpty(
    referrals.map((r) =>
      joinNonEmpty([r.treatment_given, r.treatment_plan], " · "),
    ),
    "\n",
  );
  const diagnosis = joinNonEmpty(
    referrals.map((r) => r.final_diagnosis ?? r.initial_diagnosis ?? null),
    "\n",
  );
  const chiefComplaint = latest?.chief_complaint ?? null;
  const peFindings = joinNonEmpty(
    referrals.map((r) => r.assessment_notes ?? null),
    "\n",
  );

  // Disposition.
  const wasReferred = referrals.length > 0;
  const wasUnderObservation = referrals.some(
    (r) =>
      r.received_at &&
      !r.discharged_at &&
      r.status !== "rejected" &&
      r.status !== "discharged",
  );
  const wasTreated =
    incident.status === "resolved" || incident.status === "closed";
  const remarks = joinNonEmpty(
    [
      ...referrals.map((r) => r.discharge_notes ?? null),
      incident.resolution_notes ?? null,
    ],
    "\n",
  );

  const reportDate = formatInTimeZone(
    new Date(incident.reported_at),
    PALARO_TZ,
    "MM/dd/yyyy",
  );
  const incidentDateTime = formatInTimeZone(
    new Date(incident.reported_at),
    PALARO_TZ,
    "MM/dd/yyyy · HH:mm",
  );

  return (
    <article className="patient-referral-form mx-auto w-[210mm] bg-white p-[8mm] text-black [font-family:'Times_New_Roman',Times,serif]">
      {/* ── Header (single composite logo: seals + titles + form name) ── */}
      <header className="mb-1">
        <Image
          src="/medical_logo.png"
          alt="Palarong Pambansa 2026 — Patient Consultation/Referral Form"
          width={1252}
          height={344}
          className="mx-auto block h-auto w-full"
          priority
        />
      </header>

      {/* ── Body table ── */}
      <div className="border border-black text-[8.5pt]">
        {/* Date row */}
        <div className="grid grid-cols-[1fr_auto_110px] border-b border-black">
          <div />
          <div className="border-l border-black px-1.5 py-0.5 text-right">
            <div>Date:</div>
            <div className="italic text-[7.5pt] leading-tight">(mm/dd/yyyy)</div>
          </div>
          <div className="border-l border-black px-1.5 py-0.5 font-medium">
            {reportDate}
          </div>
        </div>

        <SectionHead>I. GENERAL INFORMATION</SectionHead>

        {/* Delegation / Region / Division / Address */}
        <div className="grid grid-cols-2">
          <div className="border-r border-black px-1.5 py-1">
            <div>
              Delegation of Patient{" "}
              <span className="italic">(Please tick one)</span>:
            </div>
            <ul className="mt-0.5 space-y-[1px]">
              {FORM_DELEGATION_OPTIONS.map((o) => (
                <li key={o} className="flex items-center gap-1.5 leading-tight">
                  <Tick checked={delegationCheck.ticked === o} />
                  <span>{o}</span>
                </li>
              ))}
              <li className="flex items-center gap-1.5 leading-tight">
                <Tick checked={!!delegationCheck.others} />
                <span>Others:</span>
                <span className="min-w-[40px] flex-1 border-b border-black px-1 text-[8.5pt]">
                  {delegationCheck.others ?? ""}
                </span>
                <span className="italic text-[7.5pt]">(please specify)</span>
              </li>
            </ul>
          </div>
          <div className="flex flex-col">
            <div className="border-b border-black px-1.5 py-1">
              <div className="italic leading-tight">
                If patient is an athlete/delegation,
              </div>
              <div className="mt-0.5 leading-tight">
                Region{" "}
                <span className="italic">(N/A if from CO)</span>:{" "}
                <span className="font-medium">{region ?? ""}</span>
              </div>
            </div>
            <div className="border-b border-black px-1.5 py-1 leading-tight">
              Division{" "}
              <span className="italic">(N/A if from CO and Region)</span>:
            </div>
            <div className="px-1.5 py-1 leading-tight">
              Complete Address and Contact Number:
              <div className="italic text-[7.5pt]">
                (for Surveillance Purposes)
              </div>
            </div>
          </div>
        </div>

        {/* Name / Birthdate / Age/Sex */}
        <div className="grid grid-cols-[2fr_1fr_1fr] border-t border-black">
          <Cell
            label={
              <>
                Name of Patient{" "}
                <span className="italic">(Last Name, First Name, MI)</span>:
              </>
            }
            value={patientName}
            className="border-r border-black"
          />
          <Cell
            label={
              <>
                Birthdate <span className="italic">(mm/dd/yyyy)</span>:
              </>
            }
            value=""
            className="border-r border-black"
          />
          <Cell label="Age/Sex:" value={ageSex} />
        </div>

        {/* Sports Event */}
        <div className="border-t border-black px-1.5 py-1 leading-tight">
          Sports Event{" "}
          <span className="italic">(for athletes and coaches only)</span>:
        </div>

        {/* II / III headers */}
        <div className="grid grid-cols-2 border-t border-black">
          <SectionHead>II. DETAILS OF THE INCIDENT</SectionHead>
          <div className="border-l border-black">
            <SectionHead>III. GENERAL ASSESSMENT AND FINDINGS</SectionHead>
          </div>
        </div>

        {/* II / III body */}
        <div className="grid grid-cols-2">
          <div className="border-r border-black">
            <Cell
              label="Nature of Incident:"
              value={joinNonEmpty([incident.title, incident.description], "\n")}
              className="border-b border-black"
            />
            <Cell
              label="Place of Incident:"
              value={placeOfIncident}
              className="border-b border-black"
            />
            <Cell label="Date and Time of Incident:" value={incidentDateTime} />
          </div>
          <div>
            <Cell
              label="Chief Complaint/s:"
              value={chiefComplaint ?? ""}
              className="border-b border-black"
              minHeight="min-h-[28px]"
            />
            <Cell
              label="PE Finding/s:"
              value={peFindings}
              minHeight="min-h-[36px]"
            />
          </div>
        </div>

        <SectionHead>IV. OTHER FINDINGS</SectionHead>
        <div className="grid grid-cols-2">
          <div className="border-r border-black">
            <Cell label="Allergies:" value="" className="border-b border-black" />
            <Cell
              label="Current Medication/s:"
              value=""
              className="border-b border-black"
            />
            <Cell
              label="Past Medical History:"
              value=""
              className="border-b border-black"
            />
            <Cell label="Last Meal Taken:" value="" />
          </div>
          <div>
            <Cell
              label="Blood Pressure:"
              value={vitals.bp ?? ""}
              className="border-b border-black"
            />
            <Cell
              label="Pulse Rate:"
              value={vitals.hr != null ? `${vitals.hr} bpm` : ""}
              className="border-b border-black"
            />
            <Cell
              label="Respiration Rate:"
              value={vitals.rr != null ? `${vitals.rr} /min` : ""}
              className="border-b border-black"
            />
            <Cell
              label="Temperature:"
              value={vitals.temp != null ? `${vitals.temp}°C` : ""}
            />
          </div>
        </div>

        <SectionHead>V. TREATMENT/INTERVENTION</SectionHead>
        <div className="min-h-[44px] whitespace-pre-wrap px-1.5 py-1 text-[8.5pt] leading-snug">
          {treatment}
        </div>

        <SectionHead>VI. IMPRESSION/DIAGNOSIS</SectionHead>
        <div className="min-h-[44px] whitespace-pre-wrap px-1.5 py-1 text-[8.5pt] leading-snug">
          {diagnosis}
        </div>

        <SectionHead>VII. REMARKS/DISPOSITION</SectionHead>
        <div className="grid grid-cols-2">
          <div className="border-r border-black px-1.5 py-1">
            <ul className="space-y-[1px]">
              <li className="flex items-center gap-1.5 leading-tight">
                <Tick checked={wasTreated && !wasReferred} />
                <span>Treated</span>
              </li>
              <li className="flex items-center gap-1.5 leading-tight">
                <Tick checked={wasUnderObservation} />
                <span>Under Observation</span>
              </li>
              <li className="flex items-center gap-1.5 leading-tight">
                <Tick checked={wasReferred} />
                <span>Referred</span>
              </li>
            </ul>
          </div>
          <Cell label="Remarks:" value={remarks} minHeight="min-h-[36px]" />
        </div>

        {/* Signature line */}
        <div className="grid grid-cols-2 border-t border-black">
          <div className="border-r border-black px-1.5 pt-6 pb-1 text-center text-[8.5pt]">
            <div className="border-t border-black pt-0.5">NOD/Signature</div>
          </div>
          <div className="px-1.5 pt-6 pb-1 text-center text-[8.5pt]">
            <div className="border-t border-black pt-0.5">Physician/Signature</div>
          </div>
        </div>
      </div>

      <div className="mt-1 text-[7pt] text-blue-700">pg. 1</div>
    </article>
  );
}

export type PatientReferralFormProps = Props;
