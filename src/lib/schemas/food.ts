import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

const supplierFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contact_person: optionalShortText,
  contact_number: optionalShortText,
  email: z
    .string()
    .trim()
    .max(200)
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  cuisine_type: optionalShortText,
  capacity_meals_per_day: z.number().int().min(0).max(100_000).optional(),
  notes: optionalText,
});

export const createSupplierSchema = supplierFields;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = supplierFields.extend({
  id: z.string().uuid(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const deleteSupplierSchema = z.object({ id: z.string().uuid() });

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const requestFields = z.object({
  bq_id: z.string().uuid("Pick a billeting quarter."),
  supplier_id: z.string().uuid().nullable().optional(),
  meal_type: mealTypeSchema,
  quantity_meals: z
    .number({ message: "Meal count is required" })
    .int()
    .min(1, "At least 1 meal")
    .max(100_000),
  required_at: z
    .string()
    .min(1, "Required time is needed")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid time"),
  notes: optionalText,
});

export const createRequestSchema = requestFields;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const updateRequestSchema = requestFields.extend({
  id: z.string().uuid(),
});
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

export const requestStatusSchema = z.enum([
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
]);

export const setRequestStatusSchema = z.object({
  id: z.string().uuid(),
  status: requestStatusSchema,
  notes: optionalText,
});
export type SetRequestStatusInput = z.infer<typeof setRequestStatusSchema>;

export const deleteRequestSchema = z.object({ id: z.string().uuid() });
