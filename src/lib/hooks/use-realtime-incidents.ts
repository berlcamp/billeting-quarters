"use client";

import { useRouter } from "next/navigation";
import { useRealtimePostgresChanges } from "./use-realtime";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

interface UseRealtimeIncidentsOptions {
  /** Fired once per inserted incident with severity = critical. */
  onCritical?: (incident: Incident) => void;
}

// Subscribes to palaro.incidents and pings router.refresh() on any change.
// Renders should always come from server-fed props — keeping a local copy in
// useState goes stale on subsequent server-side updates (router.refresh()
// passes new props, but useState only honors `initial` on first mount).
export function useRealtimeIncidents(options?: UseRealtimeIncidentsOptions) {
  const router = useRouter();

  useRealtimePostgresChanges<Incident>(
    { schema: "palaro", table: "incidents" },
    (payload) => {
      if (payload.eventType === "INSERT") {
        const next = payload.new as Incident;
        if (next?.severity === "critical") {
          options?.onCritical?.(next);
        }
      }
      router.refresh();
    },
  );
}
