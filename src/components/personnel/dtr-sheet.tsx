import { formatInTimeZone } from "date-fns-tz";
import { PALARO_TZ } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];
type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];

interface Props {
  personnel: Personnel;
  // Inclusive list of YYYY-MM-DD (Asia/Manila) days the sheet should cover.
  days: string[];
  // Pre-filtered logs for this personnel (any subset is fine — we re-bucket here).
  logs: AttendanceLog[];
  periodLabel: string;
}

interface DayRow {
  amIn: Date | null;
  amOut: Date | null;
  pmIn: Date | null;
  pmOut: Date | null;
  hours: number;
}

// Bucket a day's logs into AM/PM arrival/departure cells.
//   AM In  = earliest time_in  with manila-hour < 12
//   AM Out = latest   time_out with manila-hour < 13   (lunch grace)
//   PM In  = earliest time_in  with manila-hour >= 12
//   PM Out = latest   time_out with manila-hour >= 12
// Hours = (AM Out - AM In) + (PM Out - PM In), each pair only counted when both
// sides are present.
function bucketDay(dayLogs: AttendanceLog[]): DayRow {
  let amIn: Date | null = null;
  let amOut: Date | null = null;
  let pmIn: Date | null = null;
  let pmOut: Date | null = null;

  for (const log of dayLogs) {
    const ts = new Date(log.scanned_at);
    const hour = Number(formatInTimeZone(ts, PALARO_TZ, "H"));
    if (log.type === "time_in") {
      if (hour < 12) {
        if (!amIn || ts < amIn) amIn = ts;
      } else {
        if (!pmIn || ts < pmIn) pmIn = ts;
      }
    } else {
      if (hour < 13) {
        if (!amOut || ts > amOut) amOut = ts;
      }
      if (hour >= 12) {
        if (!pmOut || ts > pmOut) pmOut = ts;
      }
    }
  }

  let ms = 0;
  if (amIn && amOut && amOut > amIn) ms += amOut.getTime() - amIn.getTime();
  if (pmIn && pmOut && pmOut > pmIn) ms += pmOut.getTime() - pmIn.getTime();
  const hours = ms / 3_600_000;

  return { amIn, amOut, pmIn, pmOut, hours };
}

function fmtCell(d: Date | null): string {
  if (!d) return "";
  return formatInTimeZone(d, PALARO_TZ, "HH:mm");
}

export function DtrSheet({ personnel, days, logs, periodLabel }: Props) {
  // Index logs by day (Asia/Manila).
  const byDay = new Map<string, AttendanceLog[]>();
  for (const log of logs) {
    const day = formatInTimeZone(
      new Date(log.scanned_at),
      PALARO_TZ,
      "yyyy-MM-dd",
    );
    const arr = byDay.get(day) ?? [];
    arr.push(log);
    byDay.set(day, arr);
  }

  const rows = days.map((day) => {
    const dayLogs = byDay.get(day) ?? [];
    return { day, ...bucketDay(dayLogs) };
  });

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);

  return (
    <section
      className="dtr-sheet bg-white p-6 text-black"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* Letterhead */}
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide">
          Republic of the Philippines
        </p>
        <p className="text-[11px] uppercase tracking-wide">
          Palarong Pambansa 2026 — Agusan del Sur
        </p>
        <h1 className="mt-2 text-base font-bold uppercase tracking-wider">
          Daily Time Record
        </h1>
        <p className="text-[11px] italic">(CSC Form No. 48)</p>
      </header>

      {/* Personnel block */}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
        <div className="col-span-2">
          <span className="font-semibold">Name:</span>{" "}
          <span className="border-b border-black px-1 font-bold uppercase">
            {personnel.full_name}
          </span>
        </div>
        <div>
          <span className="font-semibold">Designation:</span>{" "}
          <span className="border-b border-black px-1">
            {personnel.designation ?? "—"}
          </span>
        </div>
        <div>
          <span className="font-semibold">Committee:</span>{" "}
          <span className="border-b border-black px-1">
            {personnel.committee}
          </span>
        </div>
        <div>
          <span className="font-semibold">Agency:</span>{" "}
          <span className="border-b border-black px-1">
            {personnel.agency ?? "—"}
          </span>
        </div>
        <div>
          <span className="font-semibold">Area assigned:</span>{" "}
          <span className="border-b border-black px-1">
            {personnel.area_assigned ?? "—"}
          </span>
        </div>
        <div className="col-span-2">
          <span className="font-semibold">For the period:</span>{" "}
          <span className="border-b border-black px-1">{periodLabel}</span>
        </div>
      </div>

      {/* DTR table */}
      <table className="dtr-table mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-black px-1 py-1">
              Day
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1">
              Date
            </th>
            <th colSpan={2} className="border border-black px-1 py-1">
              A.M.
            </th>
            <th colSpan={2} className="border border-black px-1 py-1">
              P.M.
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1">
              Total Hrs
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1">
              Remarks
            </th>
          </tr>
          <tr>
            <th className="border border-black px-1 py-1">Arrival</th>
            <th className="border border-black px-1 py-1">Departure</th>
            <th className="border border-black px-1 py-1">Arrival</th>
            <th className="border border-black px-1 py-1">Departure</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dt = new Date(`${row.day}T12:00:00+08:00`);
            const dayName = formatInTimeZone(dt, PALARO_TZ, "EEE");
            const dateLabel = formatInTimeZone(dt, PALARO_TZ, "MMM d");
            const isWeekend = dayName === "Sat" || dayName === "Sun";
            const hoursLabel = row.hours > 0 ? row.hours.toFixed(2) : "";
            return (
              <tr
                key={row.day}
                className={isWeekend ? "bg-[#f3f3f3]" : undefined}
              >
                <td className="border border-black px-1 py-1 text-center font-medium">
                  {dayName}
                </td>
                <td className="border border-black px-1 py-1 text-center">
                  {dateLabel}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono">
                  {fmtCell(row.amIn)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono">
                  {fmtCell(row.amOut)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono">
                  {fmtCell(row.pmIn)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono">
                  {fmtCell(row.pmOut)}
                </td>
                <td className="border border-black px-1 py-1 text-center font-mono">
                  {hoursLabel}
                </td>
                <td className="border border-black px-1 py-1" />
              </tr>
            );
          })}
          <tr>
            <td
              colSpan={6}
              className="border border-black px-2 py-1 text-right font-semibold"
            >
              TOTAL
            </td>
            <td className="border border-black px-1 py-1 text-center font-mono font-bold">
              {totalHours > 0 ? totalHours.toFixed(2) : ""}
            </td>
            <td className="border border-black px-1 py-1" />
          </tr>
        </tbody>
      </table>

      {/* Certification + signatures */}
      <p className="mt-3 text-[11px] leading-snug">
        I certify on my honor that the above is a true and correct report of
        the hours of work performed, record of which was made daily at the time
        of arrival and departure from office.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black pt-1 font-semibold uppercase">
            {personnel.full_name}
          </div>
          <div>Personnel Signature</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-1 font-semibold">
            &nbsp;
          </div>
          <div>Verified as to the prescribed office hours</div>
          <div className="mt-1 text-[10px] italic">In-charge / Supervisor</div>
        </div>
      </div>
    </section>
  );
}
