import { z } from "zod";

const optionalText = z.string().trim().max(1000).optional();
const optionalShortText = z.string().trim().max(120).optional();

const supplyFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: optionalShortText,
  unit: z.string().trim().min(1, "Unit is required").max(40),
  current_stock: z.number().int().min(0).max(1_000_000).optional(),
  reorder_level: z.number().int().min(0).max(1_000_000).optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
  storage_site_id: z.string().uuid().nullable().optional(),
  notes: optionalText,
});

export const createSupplySchema = supplyFields;
export type CreateSupplyInput = z.infer<typeof createSupplySchema>;

export const updateSupplySchema = supplyFields.extend({
  id: z.string().uuid(),
});
export type UpdateSupplyInput = z.infer<typeof updateSupplySchema>;

export const deleteSupplySchema = z.object({ id: z.string().uuid() });

export const supplyMovementTypeSchema = z.enum([
  "stock_in",
  "stock_out",
  "adjustment",
  "expired",
]);

// `quantity` is always a positive count entered by the operator. The server
// converts it to a signed delta based on movement_type before applying it
// to current_stock.
export const recordMovementSchema = z.object({
  supply_id: z.string().uuid("Pick a supply item."),
  movement_type: supplyMovementTypeSchema,
  quantity: z
    .number({ message: "Quantity is required" })
    .int()
    .min(1, "Quantity must be at least 1")
    .max(1_000_000),
  reason: optionalText,
  reference_type: optionalShortText,
  reference_id: z.string().uuid().nullable().optional(),
});
export type RecordMovementInput = z.infer<typeof recordMovementSchema>;
