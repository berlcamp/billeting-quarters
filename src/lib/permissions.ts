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
  "raffle_manager",
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
  bq_head: "BQ Head",
  transportation_head: "Transportation Head",
  transportation_dispatcher: "Transportation Dispatcher",
  transportation_driver: "Transportation Driver",
  garbage_logger: "Garbage Logger",
  food_supplier_admin: "Food Supplier Admin",
  incident_monitoring: "Incident Monitoring",
  information_hub_officer: "Information Hub Officer",
  attendance_checker: "Attendance Checker",
  head_counter_viewer: "Head Counter Viewer",
  command_center_viewer: "Command Center Viewer",
  raffle_manager: "Raffle Manager",
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
  "site_monitoring.log",
  "site_monitoring.manage",
  "external_personnel.log",
  "end_of_day.log",
  "head_count.encode_own",
  "head_count.view_all",
  "head_count.venue_encode",
  "head_count.venue_view_all",
  "raffle.view",
  "raffle.manage",
  "raffle.draw",
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
    "site_monitoring.manage",
    "external_personnel.log",
    "end_of_day.log",
    "head_count.view_all",
    "head_count.venue_view_all",
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
  protocol_officer: [
    "incident.create",
    "incident.view",
    "vip.manage",
  ],
  logistics_officer: [
    "incident.create",
    "incident.view",
    "vehicle.manage",
    "vehicle.dispatch",
    "vehicle.fuel",
    "garbage.manage",
    "food.manage",
  ],
  personnel_admin: [
    "personnel.manage",
    "attendance.record",
    "head_count.view_all",
    "head_count.venue_view_all",
  ],
  venue_manager: [
    "incident.create",
    "incident.view",
    "venue.book",
    "venue.approve_special",
    "heat_index.record",
    "food.request",
    "head_count.venue_encode",
    "head_count.venue_view_all",
  ],
  delegation_head: [
    "incident.create",
    "incident.view",
    "food.request",
  ],
  // BQ Head — Billeting-Quarter Head, assigned to one delegation. The only
  // role that can encode the daily Head Counter for its delegation, and the
  // only module they can access.
  bq_head: ["head_count.encode_own"],
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
  // Can view, create, and change status on incidents; cannot refer.
  incident_monitoring: ["incident.create", "incident.view", "incident.update"],
  // Information Hub Officer — stationed at a billeting quarter. Requests
  // garbage pickup, logs site visits / external personnel / end-of-day
  // headcount, and reports incidents (including moving them through the
  // status flow). Also manages the recurring weekly garbage schedule and
  // collectors at their hub.
  information_hub_officer: [
    "incident.create",
    "incident.view",
    "incident.update",
    "garbage.log",
    "garbage.manage",
    "site_monitoring.log",
    "external_personnel.log",
    "end_of_day.log",
    "food.request",
  ],
  // Attendance Checker — kiosk-style role for personnel manning the
  // time-in/time-out station. Can only access the Attendance module
  // (manual + QR scan logging); no personnel CRUD, no other modules.
  attendance_checker: ["attendance.record"],
  // Head Counter Viewer — read-only access to both Head Counter tabs (BQ +
  // Venue) across all delegations and venues, including the consolidated
  // print sheets. No encoding, no other modules. The page treats the
  // *_view_all permissions as admin (shows the entity switcher + Print
  // button); grids are read-only because this role lacks the encode
  // permissions.
  head_counter_viewer: ["head_count.view_all", "head_count.venue_view_all"],
  // Command Center Viewer — view-only access to the Command Center dashboard
  // and nothing else. Granting zero permissions is intentional: the
  // dashboard page is open to every signed-in user, and every outbound link
  // on it is permission-gated, so an empty grant produces a fully read-only
  // view with no clickable navigation.
  command_center_viewer: [],
  // Raffle Manager — full Raffle module access (view, manage, draw). Holds
  // no other module permissions, so the only nav item that surfaces is
  // Raffle (plus the always-public Command Center root and User Guide).
  raffle_manager: ["raffle.view", "raffle.manage", "raffle.draw"],
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
