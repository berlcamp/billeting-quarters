"use client";

import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/permissions";
import { useProfile } from "./use-profile";

export function usePermissions() {
  const { profile, loading } = useProfile();
  return {
    loading,
    can: (permission: Permission) => hasPermission(profile, permission),
    canAny: (permissions: Permission[]) =>
      hasAnyPermission(profile, permissions),
    canAll: (permissions: Permission[]) =>
      hasAllPermissions(profile, permissions),
  };
}
