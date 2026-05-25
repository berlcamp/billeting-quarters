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
  day: string;
  ins: Date[];
  outs: Date[];
  hours: number;
  remarks: string[];
}

function manilaDay(ts: Date): string {
  return formatInTimeZone(ts, PALARO_TZ, "yyyy-MM-dd");
}

// Pair INs with OUTs over the whole period (not per-day), so overnight shifts
// (22:00 IN → 06:00 OUT) no longer vanish from the total. Paired hours are
// attributed to the day of the IN. Same-day extra INs keep the historical
// "gap counts" behaviour (forgot to tap out, then re-tapped), but a cross-day
// extra IN closes the prior shift unpaired — otherwise a forgotten OUT would
// silently inflate the next morning's shift into a ~20-hour day. Anything
// that doesn't pair cleanly is surfaced in the Remarks column instead of
// quietly skewing the total.
function computePeriod(
  logs: AttendanceLog[],
  days: string[],
): { rows: DayRow[]; totalHours: number } {
  const byDay = new Map<string, { ins: Date[]; outs: Date[] }>();
  for (const d of days) byDay.set(d, { ins: [], outs: [] });

  type Event = { ts: Date; type: AttendanceLog["type"]; day: string };
  const events: Event[] = [];

  for (const log of logs) {
    const ts = new Date(log.scanned_at);
    const day = manilaDay(ts);
    let entry = byDay.get(day);
    if (!entry) {
      entry = { ins: [], outs: [] };
      byDay.set(day, entry);
    }
    if (log.type === "time_in") entry.ins.push(ts);
    else entry.outs.push(ts);
    events.push({ ts, type: log.type, day });
  }

  events.sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const hoursByDay = new Map<string, number>();
  const remarksByDay = new Map<string, string[]>();
  const addRemark = (day: string, note: string) => {
    const arr = remarksByDay.get(day) ?? [];
    if (!arr.includes(note)) arr.push(note);
    remarksByDay.set(day, arr);
  };

  let openIn: { ts: Date; day: string } | null = null;

  for (const evt of events) {
    if (evt.type === "time_in") {
      if (!openIn) {
        openIn = { ts: evt.ts, day: evt.day };
      } else if (openIn.day === evt.day) {
        addRemark(evt.day, "Missing time-out between scans");
      } else {
        addRemark(openIn.day, "Missing time-out");
        openIn = { ts: evt.ts, day: evt.day };
      }
    } else if (openIn && evt.ts > openIn.ts) {
      const hrs = (evt.ts.getTime() - openIn.ts.getTime()) / 3_600_000;
      hoursByDay.set(openIn.day, (hoursByDay.get(openIn.day) ?? 0) + hrs);
      if (openIn.day !== evt.day) {
        addRemark(
          openIn.day,
          `Overnight — out ${formatInTimeZone(evt.ts, PALARO_TZ, "MMM d HH:mm")}`,
        );
        addRemark(
          evt.day,
          `Overnight — in ${formatInTimeZone(openIn.ts, PALARO_TZ, "MMM d HH:mm")}`,
        );
      }
      openIn = null;
    } else {
      addRemark(evt.day, "Time-out without time-in");
    }
  }
  if (openIn) addRemark(openIn.day, "Missing time-out");

  const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();
  const rows: DayRow[] = days.map((day) => {
    const entry = byDay.get(day) ?? { ins: [], outs: [] };
    entry.ins.sort(byTime);
    entry.outs.sort(byTime);
    return {
      day,
      ins: entry.ins,
      outs: entry.outs,
      hours: hoursByDay.get(day) ?? 0,
      remarks: remarksByDay.get(day) ?? [],
    };
  });

  const totalHours = rows.reduce((sum, r) => sum + r.hours, 0);
  return { rows, totalHours };
}

function fmtCell(dates: Date[]): string {
  return dates
    .map((d) => formatInTimeZone(d, PALARO_TZ, "HH:mm"))
    .join("\n");
}

export function DtrSheet({ personnel, days, logs, periodLabel }: Props) {
  const { rows, totalHours } = computePeriod(logs, days);

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
                <td className="border border-black px-1 py-1 align-top text-[10px] leading-tight">
                  {row.remarks.length ? row.remarks.join("; ") : null}
                </td>
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
