"use client";

import { useState } from "react";
import { useRealtimePostgresChanges } from "./use-realtime";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

interface UseRealtimeIncidentsOptions {
  /** Fired once per inserted incident with severity = critical. */
  onCritical?: (incident: Incident) => void;
}

// Live-mirrors palaro.incidents starting from a server-rendered initial array.
// The realtime channel layers INSERT/UPDATE/DELETE events on top of `initial`.
export function useRealtimeIncidents(
  initial: Incident[],
  options?: UseRealtimeIncidentsOptions,
) {
  const [incidents, setIncidents] = useState<Incident[]>(initial);

  useRealtimePostgresChanges<Incident>(
    { schema: "palaro", table: "incidents" },
    (payload) => {
      if (payload.eventType === "INSERT") {
        const next = payload.new as Incident;
        setIncidents((prev) => {
          if (prev.some((i) => i.id === next.id)) return prev;
          return [next, ...prev];
        });
        if (next.severity === "critical") {
          options?.onCritical?.(next);
        }
      } else if (payload.eventType === "UPDATE") {
        const next = payload.new as Incident;
        setIncidents((prev) =>
          prev.map((i) => (i.id === next.id ? next : i)),
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as Partial<Incident>;
        if (!old.id) return;
        setIncidents((prev) => prev.filter((i) => i.id !== old.id));
      }
    },
  );

  return incidents;
}
