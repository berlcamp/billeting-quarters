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
  ins: Date[];
  outs: Date[];
  hours: number;
}

// Collect every scan for the day into a Time-In list and a Time-Out list (no
// AM/PM split — each cell stacks all times chronologically).
// Hours = chronological pairing across the whole day. We walk events in time
// order and pair the first unmatched time_in with the next time_out; extra
// time_ins (forgot to tap out, then re-tapped) are ignored so the gap counts.
function bucketDay(dayLogs: AttendanceLog[]): DayRow {
  const ins: Date[] = [];
  const outs: Date[] = [];
  const events: { ts: Date; type: AttendanceLog["type"] }[] = [];

  for (const log of dayLogs) {
    const ts = new Date(log.scanned_at);
    events.push({ ts, type: log.type });
    if (log.type === "time_in") ins.push(ts);
    else outs.push(ts);
  }

  const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();
  ins.sort(byTime);
  outs.sort(byTime);
  events.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  let ms = 0;
  let openIn: Date | null = null;
  for (const evt of events) {
    if (evt.type === "time_in") {
      if (!openIn) openIn = evt.ts;
    } else if (openIn && evt.ts > openIn) {
      ms += evt.ts.getTime() - openIn.getTime();
      openIn = null;
    }
  }
  const hours = ms / 3_600_000;

  return { ins, outs, hours };
}

function fmtCell(dates: Date[]): string {
  return dates
    .map((d) => formatInTimeZone(d, PALARO_TZ, "HH:mm"))
    .join("\n");
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
            <th className="border border-black px-1 py-1">Day</th>
            <th className="border border-black px-1 py-1">Date</th>
            <th className="border border-black px-1 py-1">Time-In</th>
            <th className="border border-black px-1 py-1">Time-Out</th>
            <th className="border border-black px-1 py-1">Total Hrs</th>
            <th className="border border-black px-1 py-1">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dt = new Date(`${row.day}T12:00:00+08:00`);
            const dayName = formatInTimeZone(dt, PALARO_TZ, "EEE");
            const dateLabel = formatInTimeZone(dt, PALARO_TZ, "MMM d");
            const isWeekend = dayName === "Sat" || dayName === "Sun";
            const hoursLabel = row.hours > 0 ? row.hours.toFixed(2) : "";
            const cellCls =
              "border border-black px-1 py-1 text-center font-mono whitespace-pre-line align-top leading-tight";
            return (
              <tr
                key={row.day}
                className={isWeekend ? "bg-[#f3f3f3]" : undefined}
              >
                <td className="border border-black px-1 py-1 text-center font-medium align-top">
                  {dayName}
                </td>
                <td className="border border-black px-1 py-1 text-center align-top">
                  {dateLabel}
                </td>
                <td className={cellCls}>{fmtCell(row.ins)}</td>
                <td className={cellCls}>{fmtCell(row.outs)}</td>
                <td className={cellCls}>{hoursLabel}</td>
                <td className="border border-black px-1 py-1 align-top" />
              </tr>
            );
          })}
          <tr>
            <td
              colSpan={4}
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
