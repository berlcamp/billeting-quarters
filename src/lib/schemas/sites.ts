import { z } from "zod";

export const siteTypeSchema = z.enum([
  "billeting_quarter",
  "playing_venue",
  "urgent_care_facility",
  "hospital",
  "command_center",
  "clinic",
]);

const optionalText = z.string().trim().max(500).optional();

const siteFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  site_type: siteTypeSchema,
  address: optionalText,
  contact_person: optionalText,
  contact_number: optionalText,
  capacity: z.number().int().min(0).max(1_000_000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: optionalText,
});

export const createSiteSchema = siteFields;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = siteFields.extend({
  id: z.string().uuid(),
});
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const deleteSiteSchema = z.object({ id: z.string().uuid() });
