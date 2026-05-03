"use client";

import { useState } from "react";
import { useRealtimePostgresChanges } from "./use-realtime";
import type { Database } from "@/types/database";
import type { UserRole } from "@/lib/permissions";

type Notification = Database["palaro"]["Tables"]["notifications"]["Row"];

interface UseRealtimeNotificationsOptions {
  /** Profile id of the current viewer — used to filter notifications addressed to me. */
  profileId: string;
  /** Role of the current viewer — also used to surface role-broadcasts. */
  role: UserRole | null;
  /** Fired once per inserted notification with severity = critical. */
  onCritical?: (notification: Notification) => void;
}

// Mirrors palaro.notifications, filtered to "addressed to me OR to my role".
// Realtime postgres_changes doesn't easily support OR-filters, so we subscribe
// to all events and filter client-side.
export function useRealtimeNotifications(
  initial: Notification[],
  { profileId, role, onCritical }: UseRealtimeNotificationsOptions,
) {
  const [notifications, setNotifications] = useState<Notification[]>(initial);

  useRealtimePostgresChanges<Notification>(
    { schema: "palaro", table: "notifications" },
    (payload) => {
      if (payload.eventType === "INSERT") {
        const next = payload.new as Notification;
        if (!isForMe(next, profileId, role)) return;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === next.id)) return prev;
          return [next, ...prev];
        });
        if (next.severity === "critical") onCritical?.(next);
      } else if (payload.eventType === "UPDATE") {
        const next = payload.new as Notification;
        setNotifications((prev) =>
          prev.map((n) => (n.id === next.id ? next : n)),
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as Partial<Notification>;
        if (!old.id) return;
        setNotifications((prev) => prev.filter((n) => n.id !== old.id));
      }
    },
  );

  return notifications;
}

function isForMe(
  n: Notification,
  profileId: string,
  role: UserRole | null,
): boolean {
  if (n.recipient_id === profileId) return true;
  if (role && n.recipient_role === role) return true;
  return false;
}
