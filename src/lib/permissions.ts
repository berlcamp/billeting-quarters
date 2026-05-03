import type { Database } from "@/types/database";

export type UserRole = Database["palaro"]["Enums"]["user_role"];
export type ProfileStatus = Database["palaro"]["Enums"]["profile_status"];

export const USER_ROLES: readonly UserRole[] = [
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
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  command_center: "Command Center",
  medical_field: "Medical — Field",
  medical_ucf: "Medical — UCF",
  medical_hospital: "Medical — Hospital",
  medical_clinic: "Medical — Clinic",
  protocol_officer: "Protocol Officer",
  logistics_officer: "Logistics Officer",
  personnel_admin: "Personnel Admin",
  venue_manager: "Venue Manager",
  delegation_head: "Delegation Head",
  transportation_dispatcher: "Transportation Dispatcher",
  garbage_logger: "Garbage Logger",
  food_supplier_admin: "Food Supplier Admin",
};

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
};

export const PERMISSIONS = [
  "incident.create",
  "incident.view",
  "incident.update",
  "incident.resolve",
  "referral.create_field_to_ucf",
  "referral.create_ucf_to_hospital",
  "referral.accept",
  "referral.assess",
  "referral.discharge",
  "clinic.manage",
  "supplies.manage",
  "heat_index.record",
  "heat_index.override",
  "vip.manage",
  "venue.book",
  "venue.approve_special",
  "vehicle.manage",
  "vehicle.scan",
  "personnel.manage",
  "attendance.record",
  "user.invite",
  "user.manage",
  "sites.manage",
  "delegations.manage",
  "reports.view",
  "admin.manage",
  "garbage.log",
  "garbage.manage",
  "food.request",
  "food.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  command_center: [
    "incident.create",
    "incident.view",
    "incident.update",
    "incident.resolve",
    "referral.create_field_to_ucf",
    "referral.create_ucf_to_hospital",
    "vip.manage",
    "heat_index.record",
    "heat_index.override",
    "venue.approve_special",
    "user.invite",
    "user.manage",
    "sites.manage",
    "delegations.manage",
    "reports.view",
    "garbage.manage",
    "food.manage",
  ],
  medical_field: [
    "incident.create",
    "incident.view",
    "incident.update",
    "referral.create_field_to_ucf",
  ],
  medical_ucf: [
    "incident.view",
    "referral.accept",
    "referral.assess",
    "referral.discharge",
    "referral.create_ucf_to_hospital",
    "supplies.manage",
  ],
  medical_hospital: [
    "incident.create",
    "incident.view",
    "referral.accept",
    "referral.assess",
    "referral.discharge",
  ],
  medical_clinic: [
    "incident.create",
    "incident.view",
    "clinic.manage",
    "supplies.manage",
  ],
  protocol_officer: ["incident.view", "vip.manage"],
  logistics_officer: [
    "incident.view",
    "vehicle.manage",
    "garbage.manage",
    "food.manage",
  ],
  personnel_admin: ["personnel.manage", "attendance.record"],
  venue_manager: [
    "incident.view",
    "venue.book",
    "venue.approve_special",
    "heat_index.record",
    "food.request",
  ],
  delegation_head: ["incident.view", "food.request"],
  transportation_dispatcher: ["vehicle.manage", "vehicle.scan"],
  garbage_logger: [
    "incident.create",
    "incident.view",
    "garbage.log",
  ],
  food_supplier_admin: ["incident.view", "food.manage"],
};

type ProfileLike = { role: UserRole | null } | null | undefined;

export function hasPermission(
  profile: ProfileLike,
  permission: Permission,
): boolean {
  if (!profile?.role) return false;
  return ROLE_PERMISSIONS[profile.role].includes(permission);
}

export function hasAnyPermission(
  profile: ProfileLike,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(profile, p));
}

export function hasAllPermissions(
  profile: ProfileLike,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(profile, p));
}

export function hasRole(
  profile: ProfileLike,
  allowedRoles: readonly UserRole[],
): boolean {
  return !!profile?.role && allowedRoles.includes(profile.role);
}
