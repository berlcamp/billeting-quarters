import { z } from "zod";

const optionalText = z.string().trim().max(200).optional();

const colorHex = z
  .string()
  .trim()
  .optional()
  .refine(
    (v) => !v || /^#?[0-9a-fA-F]{6}$/i.test(v),
    { message: "Use a 6-digit hex like #1a2b3c" },
  );

const delegationFields = z.object({
  region_code: z
    .string()
    .trim()
    .min(1, "Region code is required")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and dashes only"),
  region_name: z
    .string()
    .trim()
    .min(1, "Region name is required")
    .max(200),
  short_name: optionalText,
  head_of_delegation: optionalText,
  contact_number: optionalText,
  total_athletes: z.number().int().min(0).max(100_000),
  total_coaches: z.number().int().min(0).max(100_000),
  total_officials: z.number().int().min(0).max(100_000),
  color_hex: colorHex,
  assigned_bq_id: z.string().uuid().nullable().optional(),
});

export const createDelegationSchema = delegationFields;
export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;

export const updateDelegationSchema = delegationFields.extend({
  id: z.string().uuid(),
});
export type UpdateDelegationInput = z.infer<typeof updateDelegationSchema>;

export const deleteDelegationSchema = z.object({ id: z.string().uuid() });
