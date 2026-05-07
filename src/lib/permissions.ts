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
  "transportation_head",
  "transportation_dispatcher",
  "transportation_driver",
  "garbage_logger",
  "food_supplier_admin",
  "incident_monitoring",
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
  transportation_head: "Transportation Head",
  transportation_dispatcher: "Transportation Dispatcher",
  transportation_driver: "Transportation Driver",
  garbage_logger: "Garbage Logger",
  food_supplier_admin: "Food Supplier Admin",
  incident_monitoring: "Incident Monitoring",
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
  "vehicle.dispatch",
  "vehicle.fuel",
  "vehicle.drive",
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
    "heat_index.record",
  ],
  medical_ucf: [
    "incident.create",
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
  protocol_officer: ["incident.create", "incident.view", "vip.manage"],
  logistics_officer: [
    "incident.create",
    "incident.view",
    "vehicle.manage",
    "vehicle.dispatch",
    "vehicle.fuel",
    "garbage.manage",
    "food.manage",
  ],
  personnel_admin: ["personnel.manage", "attendance.record"],
  venue_manager: [
    "incident.create",
    "incident.view",
    "venue.book",
    "venue.approve_special",
    "heat_index.record",
    "food.request",
  ],
  delegation_head: ["incident.create", "incident.view", "food.request"],
  // Transportation Head — Committee leadership. Manages vehicles/routes,
  // creates dispatches, scans, logs fuel, and views reports. (~3 users)
  transportation_head: [
    "incident.create",
    "incident.view",
    "vehicle.manage",
    "vehicle.scan",
    "vehicle.dispatch",
    "vehicle.fuel",
    "reports.view",
  ],
  // Dispatcher — at the venue with the app, creates dispatches and scans
  // vehicles on arrival/departure. (~32 users)
  transportation_dispatcher: [
    "vehicle.scan",
    "vehicle.dispatch",
  ],
  // Driver — read-only awareness of their assigned routes/dispatches.
  // (Drivers in the field; scanning happens via venue dispatchers per the
  // chosen scan flow, so no scan permission here.)
  transportation_driver: ["vehicle.drive"],
  garbage_logger: [
    "incident.create",
    "incident.view",
    "garbage.log",
  ],
  food_supplier_admin: ["incident.create", "incident.view", "food.manage"],
  // Access to the Command Center dashboard and the Incidents module.
  // Can view and create incidents; cannot update, resolve, or refer.
  incident_monitoring: ["incident.create", "incident.view"],
};

type ProfileLike =
  | { roles: readonly UserRole[] | UserRole[] | null | undefined }
  | null
  | undefined;

function profileRoles(profile: ProfileLike): readonly UserRole[] {
  return profile?.roles ?? [];
}

// A profile holds the union of permissions across every role assigned to it.
export function hasPermission(
  profile: ProfileLike,
  permission: Permission,
): boolean {
  return profileRoles(profile).some((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
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
  const roles = profileRoles(profile);
  return roles.some((r) => allowedRoles.includes(r));
}

export function isSuperAdmin(profile: ProfileLike): boolean {
  return profileRoles(profile).includes("super_admin");
}

// Returns the roles that hold ANY of the given permissions, preserving the
// canonical USER_ROLES ordering. Used by the help guides to show "who can
// create records in this module" without having to maintain a parallel list.
export function rolesWithAnyPermission(
  permissions: readonly Permission[],
): UserRole[] {
  if (permissions.length === 0) return [];
  return USER_ROLES.filter((role) => {
    const granted = ROLE_PERMISSIONS[role];
    return permissions.some((p) => granted.includes(p));
  });
}
