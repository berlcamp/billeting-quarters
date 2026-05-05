// Shared helpers for the garbage module's weekly view.
//
// All week math is anchored to Asia/Manila (UTC+8, no DST). day_of_week
// follows ISO 8601: 1 = Monday … 7 = Sunday so the week always starts on
// Monday in this UI.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const DAY_OF_WEEK_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Manila wall-clock date for a given UTC instant.
function manilaParts(utc: Date): { y: number; m: number; d: number } {
  const m = new Date(utc.getTime() + MANILA_OFFSET_MS);
  return { y: m.getUTCFullYear(), m: m.getUTCMonth() + 1, d: m.getUTCDate() };
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Returns Manila-local Monday (YYYY-MM-DD) for the week containing `at`.
// `at` defaults to the current instant.
export function manilaWeekStart(at: Date = new Date()): string {
  const { y, m, d } = manilaParts(at);
  // ISO weekday for the Manila date: convert via UTC-noon to dodge TZ drift.
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  // getUTCDay: 0 = Sun … 6 = Sat. ISO: Mon = 1 … Sun = 7.
  const iso = ((noonUtc.getUTCDay() + 6) % 7) + 1;
  const monUtc = Date.UTC(y, m - 1, d - (iso - 1));
  const mon = new Date(monUtc);
  return ymd(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate());
}

// Add `days` to a YYYY-MM-DD (Manila local), returning YYYY-MM-DD.
export function addDaysYmd(start: string, days: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

// UTC ISO bounds [startUtc, endUtc) for the Manila week starting at week_start (Mon).
export function manilaWeekBoundsUtc(weekStart: string): {
  startUtc: string;
  endUtc: string;
} {
  const [y, m, d] = weekStart.split("-").map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d) - MANILA_OFFSET_MS;
  const endUtcMs = startUtcMs + 7 * 24 * 60 * 60 * 1000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

// ISO day-of-week (1=Mon..7=Sun) for a UTC instant, projected onto Manila TZ.
export function manilaIsoDayOfWeek(utcIso: string): number {
  const { y, m, d } = manilaParts(new Date(utcIso));
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  return ((noonUtc.getUTCDay() + 6) % 7) + 1;
}
