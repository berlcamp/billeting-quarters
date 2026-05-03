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

export { toZonedTime };
