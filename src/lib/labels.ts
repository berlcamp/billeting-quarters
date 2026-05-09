import type { Database } from "@/types/database";

export type SiteType = Database["palaro"]["Enums"]["site_type"];

export const SITE_TYPES: readonly SiteType[] = [
  "billeting_quarter",
  "playing_venue",
  "urgent_care_facility",
  "hospital",
  "command_center",
  "clinic",
] as const;

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  billeting_quarter: "Billeting Quarter",
  playing_venue: "Playing Venue",
  urgent_care_facility: "Urgent Care Facility",
  hospital: "Hospital",
  command_center: "Command Center",
  clinic: "Clinic",
};

export const SITE_TYPE_SHORT: Record<SiteType, string> = {
  billeting_quarter: "BQ",
  playing_venue: "PV",
  urgent_care_facility: "UCF",
  hospital: "Hospital",
  command_center: "Command Center",
  clinic: "Clinic",
};

export type IncidentCategory = Database["palaro"]["Enums"]["incident_category"];
export type IncidentSeverity = Database["palaro"]["Enums"]["incident_severity"];
export type IncidentStatus = Database["palaro"]["Enums"]["incident_status"];

export const INCIDENT_CATEGORIES: readonly IncidentCategory[] = [
  "medical",
  "utility",
  "vip_status",
  "security",
  "facility",
  "other",
] as const;

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  medical: "Medical",
  utility: "Utility",
  vip_status: "VIP Status",
  security: "Security",
  facility: "Facility",
  other: "Other",
};

export const SEVERITIES: readonly IncidentSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  referred: "Referred",
  resolved: "Resolved",
  closed: "Closed",
};

export type ReferralStatus = Database["palaro"]["Enums"]["referral_status"];
export type ReferralLevel = Database["palaro"]["Enums"]["referral_level"];

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  in_treatment: "In treatment",
  discharged: "Discharged",
  admitted: "Admitted",
  rejected: "Rejected",
};

export const REFERRAL_LEVEL_LABELS: Record<ReferralLevel, string> = {
  field_to_ucf: "Field → UCF",
  ucf_to_hospital: "UCF → Hospital",
  hospital_admit: "Hospital admit",
};

export const ACTIVE_REFERRAL_STATUSES: readonly ReferralStatus[] = [
  "pending",
  "accepted",
  "in_treatment",
] as const;

export const PATIENT_GENDERS = ["male", "female", "other"] as const;
export type PatientGender = (typeof PATIENT_GENDERS)[number];
export const PATIENT_GENDER_LABELS: Record<PatientGender, string> = {
  male: "Male",
  female: "Female",
  other: "Other / unspecified",
};

export type VipMovementStatus =
  Database["palaro"]["Enums"]["vip_movement_status"];

export const VIP_MOVEMENT_STATUSES: readonly VipMovementStatus[] = [
  "eta_logged",
  "arrived",
  "etd_logged",
  "departed",
  "cancelled",
] as const;

export const VIP_MOVEMENT_STATUS_LABELS: Record<VipMovementStatus, string> = {
  eta_logged: "ETA logged",
  arrived: "Arrived",
  etd_logged: "ETD logged",
  departed: "Departed",
  cancelled: "Cancelled",
};

export const VIP_MOVEMENT_STATUS_BADGE: Record<VipMovementStatus, string> = {
  eta_logged: "bg-yellow-100 text-yellow-800",
  arrived: "bg-blue-100 text-blue-800",
  etd_logged: "bg-violet-100 text-violet-800",
  departed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export const ACTIVE_VIP_STATUSES: readonly VipMovementStatus[] = [
  "eta_logged",
  "arrived",
  "etd_logged",
] as const;

export type VipLogRequestStatus =
  Database["palaro"]["Enums"]["vip_log_request_status"];

export const VIP_LOG_REQUEST_STATUSES: readonly VipLogRequestStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "denied",
] as const;

export const VIP_LOG_REQUEST_STATUS_LABELS: Record<
  VipLogRequestStatus,
  string
> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  denied: "Denied",
};

export const VIP_LOG_REQUEST_STATUS_BADGE: Record<
  VipLogRequestStatus,
  string
> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
};

export type AttendanceType = Database["palaro"]["Enums"]["attendance_type"];

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  time_in: "Time in",
  time_out: "Time out",
};

export const ATTENDANCE_TYPE_BADGE: Record<AttendanceType, string> = {
  time_in: "bg-green-100 text-green-800",
  time_out: "bg-blue-100 text-blue-800",
};

export const AFFECTED_PERSON_ROLES = [
  "Athlete",
  "Coach",
  "Official",
  "Spectator",
  "Volunteer",
  "Staff",
  "Other",
] as const;

export type VehicleType = Database["palaro"]["Enums"]["vehicle_type"];

export const VEHICLE_TYPES: readonly VehicleType[] = [
  "bus",
  "van",
  "multicab",
  "pedicab",
  "ambulance",
  "service_vehicle",
] as const;

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  bus: "Bus",
  van: "Van",
  multicab: "Multicab",
  pedicab: "Pedicab",
  ambulance: "Ambulance",
  service_vehicle: "Service vehicle",
};

export type VehicleLogDirection =
  Database["palaro"]["Enums"]["vehicle_log_direction"];

export const VEHICLE_LOG_DIRECTION_LABELS: Record<VehicleLogDirection, string> =
  {
    in: "Arrival",
    out: "Departure",
  };

export const VEHICLE_LOG_DIRECTION_BADGE: Record<VehicleLogDirection, string> =
  {
    in: "bg-green-100 text-green-800",
    out: "bg-blue-100 text-blue-800",
  };

export type DispatchStatus = Database["palaro"]["Enums"]["dispatch_status"];

export const DISPATCH_STATUSES: readonly DispatchStatus[] = [
  "scheduled",
  "in_transit",
  "completed",
  "cancelled",
] as const;

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  scheduled: "Scheduled",
  in_transit: "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const DISPATCH_STATUS_BADGE: Record<DispatchStatus, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  in_transit: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export type ScheduleStatus = Database["palaro"]["Enums"]["schedule_status"];

export const SCHEDULE_STATUSES: readonly ScheduleStatus[] = [
  "booked",
  "special_request",
  "cancelled",
  "completed",
] as const;

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  booked: "Booked",
  special_request: "Special request",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const SCHEDULE_STATUS_BADGE: Record<ScheduleStatus, string> = {
  booked: "bg-blue-100 text-blue-800",
  special_request: "bg-yellow-100 text-yellow-800",
  cancelled: "bg-gray-100 text-gray-800",
  completed: "bg-green-100 text-green-800",
};

// Common Palaro sports — used as combobox suggestions when booking a venue.
export const PALARO_SPORTS = [
  "Athletics",
  "Arnis",
  "Badminton",
  "Baseball",
  "Basketball",
  "Billiards",
  "Boxing",
  "Chess",
  "Football",
  "Futsal",
  "Gymnastics",
  "Karatedo",
  "Pencak Silat",
  "Sepak Takraw",
  "Softball",
  "Swimming",
  "Table Tennis",
  "Taekwondo",
  "Tennis",
  "Volleyball",
  "Wrestling",
  "Wushu",
] as const;

export type SupplyMovementType =
  Database["palaro"]["Enums"]["supply_movement_type"];

export const SUPPLY_MOVEMENT_TYPES: readonly SupplyMovementType[] = [
  "stock_in",
  "stock_out",
  "adjustment",
  "expired",
] as const;

export const SUPPLY_MOVEMENT_TYPE_LABELS: Record<SupplyMovementType, string> = {
  stock_in: "Stock in",
  stock_out: "Stock out",
  adjustment: "Adjustment",
  expired: "Expired / discarded",
};

export const SUPPLY_MOVEMENT_TYPE_BADGE: Record<SupplyMovementType, string> = {
  stock_in: "bg-green-100 text-green-800",
  stock_out: "bg-blue-100 text-blue-800",
  adjustment: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
};

export const SUPPLY_CATEGORIES = [
  "Medication",
  "Consumable",
  "Equipment",
  "First aid",
  "Other",
] as const;

export const SUPPLY_UNITS = [
  "pcs",
  "box",
  "bottle",
  "vial",
  "tablet",
  "pack",
  "roll",
  "set",
] as const;

// Food request lifecycle is a free-form TEXT column on the table — these are
// the values the app produces. Anything else from a stale row maps to "other".
export const FOOD_REQUEST_STATUSES = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
] as const;

export type FoodRequestStatus = (typeof FOOD_REQUEST_STATUSES)[number];

export const FOOD_REQUEST_STATUS_LABELS: Record<FoodRequestStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const FOOD_REQUEST_STATUS_BADGE: Record<FoodRequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};
