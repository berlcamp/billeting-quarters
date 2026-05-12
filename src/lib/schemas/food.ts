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
  business_category: optionalShortText,
  notes: optionalText,
});

export const createSupplierSchema = supplierFields;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = supplierFields.extend({
  id: z.string().uuid(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const deleteSupplierSchema = z.object({ id: z.string().uuid() });

const requestFields = z.object({
  bq_id: z.string().uuid("Pick a billeting quarter."),
  supplier_id: z.string().uuid().nullable().optional(),
  item_name: z
    .string()
    .trim()
    .min(1, "Food item is required")
    .max(200),
  unit: z.string().trim().min(1, "Unit is required").max(40),
  quantity: z
    .number({ message: "Quantity is required" })
    .min(0.01, "Quantity must be greater than 0")
    .max(1_000_000),
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

// Replaces the supplier's full delegation-assignment list.
export const setSupplierDelegationsSchema = z.object({
  supplier_id: z.string().uuid(),
  delegation_ids: z.array(z.string().uuid()).max(50),
});
export type SetSupplierDelegationsInput = z.infer<
  typeof setSupplierDelegationsSchema
>;

// Command Center / food admin reassigning a request after the auto-pick.
export const reassignRequestSupplierSchema = z.object({
  id: z.string().uuid(),
  supplier_id: z.string().uuid().nullable(),
});
export type ReassignRequestSupplierInput = z.infer<
  typeof reassignRequestSupplierSchema
>;
