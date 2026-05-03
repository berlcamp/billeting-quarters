import { z } from "zod";

export const userRoleSchema = z.enum([
  "super_admin",
  "command_center",
  "medical_field",
  "medical_ucf",
  "medical_hospital",
  "medical_clinic",
  "protocol_officer",
  "logistics_officer",
  "personnel_admin",
  "venue_manager",
  "delegation_head",
  "transportation_dispatcher",
  "garbage_logger",
  "food_supplier_admin",
]);

export const profileStatusSchema = z.enum(["active", "suspended"]);

const optionalNonEmpty = z.string().trim().max(200).optional();

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  full_name: optionalNonEmpty,
  role: userRoleSchema,
  agency: optionalNonEmpty,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserDetailsSchema = z.object({
  user_id: z.string().uuid(),
  full_name: optionalNonEmpty,
  agency: optionalNonEmpty,
  designation: optionalNonEmpty,
  primary_assignment_site_id: z.string().uuid().nullable().optional(),
});
export type UpdateUserDetailsInput = z.infer<typeof updateUserDetailsSchema>;

export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: userRoleSchema,
});

export const updateUserStatusSchema = z.object({
  user_id: z.string().uuid(),
  status: profileStatusSchema,
});
