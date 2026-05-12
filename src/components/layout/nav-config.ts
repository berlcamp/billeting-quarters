import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Contact,
  Crown,
  Flag,
  HeartPulse,
  HelpCircle,
  Hospital,
  LayoutDashboard,
  MapPin,
  Package,
  Pill,
  Radar,
  Settings,
  Stethoscope,
  Thermometer,
  Trash2,
  Truck,
  UtensilsCrossed,
  Users,
  FileText,
} from "lucide-react";
import { ROLE_PERMISSIONS, type Permission, type UserRole } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Either of these may gate the item; both omitted = visible to every
  // signed-in user. If `permission` is set, the user must hold a role that
  // grants it (super_admin always passes). If `roles` is set, ANY match wins.
  roles?: UserRole[];
  permission?: Permission;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Command Center",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Incidents",
        href: "/dashboard/incidents",
        icon: AlertTriangle,
        permission: "incident.create",
      },
      {
        label: "VIP Tracking",
        href: "/dashboard/vip",
        icon: Crown,
        roles: ["protocol_officer", "command_center"],
      },
      {
        label: "Heat Index",
        href: "/dashboard/heat-index",
        icon: Thermometer,
        roles: ["medical_field", "venue_manager", "command_center"],
      },
      {
        label: "Site Monitoring",
        href: "/dashboard/site-monitoring",
        icon: Radar,
        roles: ["information_hub_officer", "command_center"],
      },
    ],
  },
  {
    label: "Medical",
    items: [
      {
        label: "Medical Incidents",
        href: "/dashboard/medical/incidents",
        icon: HeartPulse,
        roles: ["medical_field"],
      },
      {
        label: "UCF",
        href: "/dashboard/medical/ucf",
        icon: Stethoscope,
        roles: ["medical_ucf"],
      },
      {
        label: "Hospital",
        href: "/dashboard/medical/hospital",
        icon: Hospital,
        roles: ["medical_hospital"],
      },
      {
        label: "Clinic",
        href: "/dashboard/medical/clinic",
        icon: Pill,
        roles: ["medical_clinic"],
      },
      {
        label: "Supplies",
        href: "/dashboard/medical/supplies",
        icon: Package,
        roles: [
          "medical_field",
          "medical_ucf",
          "medical_hospital",
          "medical_clinic",
        ],
      },
    ],
  },
  {
    label: "Logistics",
    items: [
      {
        label: "Transportation",
        href: "/dashboard/transportation",
        icon: Truck,
        roles: [
          "logistics_officer",
          "transportation_head",
          "transportation_dispatcher",
          "transportation_driver",
        ],
      },
      {
        label: "Venues",
        href: "/dashboard/venues",
        icon: MapPin,
        roles: ["venue_manager", "logistics_officer"],
      },
      {
        label: "Garbage",
        href: "/dashboard/logistics/garbage",
        icon: Trash2,
        roles: [
          "logistics_officer",
          "garbage_logger",
          "command_center",
          "information_hub_officer",
        ],
      },
      {
        label: "Food Supply",
        href: "/dashboard/logistics/food",
        icon: UtensilsCrossed,
        roles: [
          "logistics_officer",
          "food_supplier_admin",
          "venue_manager",
          "delegation_head",
          "command_center",
        ],
      },
    ],
  },
  {
    label: "Personnel",
    items: [
      {
        label: "Personnel",
        href: "/dashboard/personnel/list",
        icon: Contact,
        roles: ["personnel_admin"],
      },
      {
        label: "Duty Schedule",
        href: "/dashboard/personnel/duty",
        icon: Calendar,
        roles: ["personnel_admin"],
      },
      {
        label: "Attendance",
        href: "/dashboard/personnel/attendance",
        icon: ClipboardCheck,
        roles: ["personnel_admin"],
      },
      {
        label: "DTR",
        href: "/dashboard/personnel/dtr",
        icon: ClipboardList,
        roles: ["personnel_admin"],
      },
      {
        label: "ID Generator",
        href: "/dashboard/personnel/ids",
        icon: BadgeCheck,
        roles: ["personnel_admin"],
      },
    ],
  },
  {
    items: [
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: FileText,
        roles: ["delegation_head", "command_center"],
      },
      {
        label: "User Guide",
        href: "/dashboard/help",
        icon: HelpCircle,
        // No `roles` — visible to every signed-in user.
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Users",
        href: "/dashboard/admin/users",
        icon: Users,
        roles: [], // super_admin only
      },
      {
        label: "Sites",
        href: "/dashboard/admin/sites",
        icon: Building2,
        roles: ["command_center"],
      },
      {
        label: "Delegations",
        href: "/dashboard/admin/delegations",
        icon: Flag,
        roles: ["command_center"],
      },
      {
        label: "Settings",
        href: "/dashboard/admin/settings",
        icon: Settings,
        roles: [], // super_admin only — empty list = no non-super_admin role grants access
      },
    ],
  },
];

// Super admin sees every item. Otherwise the item is visible iff the user
// satisfies whichever of `roles` / `permission` is set on it. With neither
// set, the item is visible to every signed-in user.
export function canSeeNavItem(
  roles: readonly UserRole[] | null | undefined,
  item: NavItem,
): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes("super_admin")) return true;

  if (item.roles && !roles.some((r) => item.roles!.includes(r))) {
    return false;
  }
  if (item.permission) {
    const allowed = roles.some((r) =>
      ROLE_PERMISSIONS[r].includes(item.permission!),
    );
    if (!allowed) return false;
  }
  return true;
}
