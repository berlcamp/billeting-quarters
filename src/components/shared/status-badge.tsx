import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PROFILE_STATUS_LABELS,
  type ProfileStatus,
} from "@/lib/permissions";

type IncidentStatus =
  | "open"
  | "in_progress"
  | "referred"
  | "resolved"
  | "closed";
type IncidentSeverity = "low" | "medium" | "high" | "critical";
type ReferralStatus =
  | "pending"
  | "accepted"
  | "in_treatment"
  | "discharged"
  | "admitted"
  | "rejected";

const INCIDENT_COLORS: Record<IncidentStatus, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  referred: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const REFERRAL_COLORS: Record<ReferralStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  accepted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  in_treatment: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  discharged: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  admitted: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PROFILE_COLORS: Record<ProfileStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

type StatusBadgeProps =
  | { variant: "incident"; status: IncidentStatus; className?: string }
  | { variant: "severity"; status: IncidentSeverity; className?: string }
  | { variant: "referral"; status: ReferralStatus; className?: string }
  | { variant: "profile"; status: ProfileStatus; className?: string };

function colorFor(props: StatusBadgeProps): string {
  switch (props.variant) {
    case "incident":
      return INCIDENT_COLORS[props.status];
    case "severity":
      return SEVERITY_COLORS[props.status];
    case "referral":
      return REFERRAL_COLORS[props.status];
    case "profile":
      return PROFILE_COLORS[props.status];
  }
}

function labelFor(props: StatusBadgeProps): string {
  if (props.variant === "profile") {
    return PROFILE_STATUS_LABELS[props.status];
  }
  return props.status.replace(/_/g, " ");
}

export function StatusBadge(props: StatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-transparent capitalize",
        colorFor(props),
        props.className,
      )}
    >
      {labelFor(props)}
    </Badge>
  );
}
