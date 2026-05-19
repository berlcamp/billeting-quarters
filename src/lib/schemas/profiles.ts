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
  "bq_head",
  "transportation_head",
  "transportation_dispatcher",
  "transportation_driver",
  "garbage_logger",
  "food_supplier_admin",
  "incident_monitoring",
  "information_hub_officer",
  "attendance_checker",
  "head_counter_viewer",
  "command_center_viewer",
]);

export const profileStatusSchema = z.enum(["active", "suspended"]);

const optionalNonEmpty = z.string().trim().max(200).optional();

const userRolesSchema = z
  .array(userRoleSchema)
  .min(1, "Pick at least one role")
  .transform((roles) => Array.from(new Set(roles)));

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  full_name: optionalNonEmpty,
  roles: userRolesSchema,
  agency: optionalNonEmpty,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserDetailsSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
  full_name: optionalNonEmpty,
  agency: optionalNonEmpty,
  designation: optionalNonEmpty,
  primary_assignment_site_id: z.string().uuid().nullable().optional(),
  delegation_id: z.string().uuid().nullable().optional(),
});
export type UpdateUserDetailsInput = z.infer<typeof updateUserDetailsSchema>;

export const updateUserRolesSchema = z.object({
  user_id: z.string().uuid(),
  roles: userRolesSchema,
});

export const updateUserStatusSchema = z.object({
  user_id: z.string().uuid(),
  status: profileStatusSchema,
});
