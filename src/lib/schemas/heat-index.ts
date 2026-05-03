import { z } from "zod";

export const recordHeatReadingSchema = z.object({
  site_id: z.string().uuid("Select a venue."),
  // PH ambient range: well-defined operational bounds. Outside this range,
  // operator likely entered the wrong unit or made a typo.
  temperature_c: z
    .number({ message: "Temperature is required" })
    .min(0, "Temperature too low (°C)")
    .max(60, "Temperature too high (°C)"),
  humidity_percent: z
    .number({ message: "Humidity is required" })
    .min(0, "Humidity must be ≥ 0%")
    .max(100, "Humidity must be ≤ 100%"),
  notes: z.string().trim().max(500).optional(),
});
export type RecordHeatReadingInput = z.infer<typeof recordHeatReadingSchema>;

export const overrideSuspensionSchema = z.object({
  reading_id: z.string().uuid(),
  game_suspension_recommended: z.boolean(),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});
export type OverrideSuspensionInput = z.infer<typeof overrideSuspensionSchema>;
