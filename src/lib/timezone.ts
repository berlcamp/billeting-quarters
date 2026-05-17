import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const PALARO_TZ = "Asia/Manila";

export function formatManila(
  value: string | Date | null | undefined,
  pattern = "MMM d, yyyy · HH:mm",
): string {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), PALARO_TZ, pattern);
}

export function manilaDayBoundsUtc(dateIsoYmd: string): {
  startUtc: string;
  endUtc: string;
} {
  const [y, m, d] = dateIsoYmd.split("-").map((s) => Number(s));
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 8 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

export function todayInManila(): string {
  return formatInTimeZone(new Date(), PALARO_TZ, "yyyy-MM-dd");
}

export function manilaDateLabel(dateIsoYmd: string): string {
  const [y, m, d] = dateIsoYmd.split("-").map((s) => Number(s));
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12));
  return formatInTimeZone(noonUtc, PALARO_TZ, "EEEE, MMMM d, yyyy");
}

// Inclusive list of YYYY-MM-DD strings between `startYmd` and `endYmd`.
// Stable against DST since we anchor on Manila noon and step by 24h.
export function dateRangeManilaYmd(
  startYmd: string,
  endYmd: string,
): string[] {
  const result: string[] = [];
  const [sy, sm, sd] = startYmd.split("-").map(Number);
  const [ey, em, ed] = endYmd.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd, 12);
  const endMs = Date.UTC(ey, em - 1, ed, 12);
  for (let ms = startMs; ms <= endMs; ms += 24 * 60 * 60 * 1000) {
    result.push(formatInTimeZone(new Date(ms), PALARO_TZ, "yyyy-MM-dd"));
  }
  return result;
}

export { toZonedTime };
