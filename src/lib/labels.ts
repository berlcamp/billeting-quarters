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
