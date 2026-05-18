import { z } from "zod";

// Hard-coded Palaro 2026 event window. If the event window ever moves these
// shift in one place. The same constants gate the action's window check.
export const HEAD_COUNT_WINDOW_START = "2026-05-15";
export const HEAD_COUNT_WINDOW_END = "2026-05-31";

export const HEAD_COUNT_ROLES = [
  "athlete",
  "chaperon",
  "coach",
  "delegation_twg",
  "rd",
  "ard",
  "sds",
  "asds",
] as const;
export type HeadCountRole = (typeof HEAD_COUNT_ROLES)[number];

export const HEAD_COUNT_ROLE_LABELS: Record<HeadCountRole, string> = {
  athlete: "Athlete",
  chaperon: "Chaperon",
  coach: "Coach",
  delegation_twg: "Delegation TWG",
  rd: "RD",
  ard: "ARD",
  sds: "SDS",
  asds: "ASDS",
};

export const HEAD_COUNT_DIRECTIONS = ["in", "out"] as const;
export type HeadCountDirection = (typeof HEAD_COUNT_DIRECTIONS)[number];

export const HEAD_COUNT_DIRECTION_LABELS: Record<HeadCountDirection, string> = {
  in: "IN",
  out: "OUT",
};

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const headCounterCellInputSchema = z.object({
  direction: z.enum(HEAD_COUNT_DIRECTIONS),
  role: z.enum(HEAD_COUNT_ROLES),
  count: z.number().int().min(0).max(99999),
});
export type HeadCounterCellInput = z.infer<typeof headCounterCellInputSchema>;

export const saveHeadCounterSchema = z.object({
  delegation_id: z.string().uuid(),
  count_date: ymd,
  cells: z
    .array(headCounterCellInputSchema)
    .max(HEAD_COUNT_DIRECTIONS.length * HEAD_COUNT_ROLES.length),
});
export type SaveHeadCounterInput = z.infer<typeof saveHeadCounterSchema>;

export function isInHeadCountWindow(dateYmd: string): boolean {
  return dateYmd >= HEAD_COUNT_WINDOW_START && dateYmd <= HEAD_COUNT_WINDOW_END;
}

export function clampToHeadCountWindow(dateYmd: string): string {
  if (dateYmd < HEAD_COUNT_WINDOW_START) return HEAD_COUNT_WINDOW_START;
  if (dateYmd > HEAD_COUNT_WINDOW_END) return HEAD_COUNT_WINDOW_END;
  return dateYmd;
}
