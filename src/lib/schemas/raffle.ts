import { z } from "zod";

const trimmedName = z.string().trim().min(1, "Required").max(200);
const optionalDesignation = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const entryRowSchema = z.object({
  name: trimmedName,
  designation: optionalDesignation,
});
export type EntryRowInput = z.infer<typeof entryRowSchema>;

export const createRaffleSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateRaffleInput = z.infer<typeof createRaffleSchema>;

export const updateRaffleSchema = createRaffleSchema.extend({
  id: z.string().uuid(),
});
export type UpdateRaffleInput = z.infer<typeof updateRaffleSchema>;

export const deleteRaffleSchema = z.object({ id: z.string().uuid() });

export const createDepartmentSchema = z.object({
  raffle_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required.").max(100),
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required.").max(100),
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

export const deleteDepartmentSchema = z.object({ id: z.string().uuid() });

export const addEntriesBulkSchema = z.object({
  department_id: z.string().uuid(),
  entries: z.array(entryRowSchema).min(1, "Add at least one name.").max(5000),
});
export type AddEntriesBulkInput = z.infer<typeof addEntriesBulkSchema>;

export const updateEntrySchema = z.object({
  id: z.string().uuid(),
  name: trimmedName,
  designation: optionalDesignation,
});
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const deleteEntrySchema = z.object({ id: z.string().uuid() });

export const clearDepartmentEntriesSchema = z.object({
  department_id: z.string().uuid(),
});

export const drawWinnerSchema = z.object({
  raffle_id: z.string().uuid(),
  session_id: z.string().uuid(),
  department_id: z.string().uuid().optional(),
  prize_label: z.string().trim().max(200).optional(),
  excluded_entry_ids: z.array(z.string().uuid()).max(10000).default([]),
});
export type DrawWinnerInput = z.infer<typeof drawWinnerSchema>;

export const resetSessionSchema = z.object({
  raffle_id: z.string().uuid(),
  session_id: z.string().uuid(),
});

export const clearWinnersSchema = z.object({ raffle_id: z.string().uuid() });
