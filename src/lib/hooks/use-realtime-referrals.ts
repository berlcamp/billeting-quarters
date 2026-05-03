"use client";

import { useState } from "react";
import { useRealtimePostgresChanges } from "./use-realtime";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

export function useRealtimeReferrals(initial: Referral[]) {
  const [referrals, setReferrals] = useState<Referral[]>(initial);

  useRealtimePostgresChanges<Referral>(
    { schema: "palaro", table: "referrals" },
    (payload) => {
      if (payload.eventType === "INSERT") {
        const next = payload.new as Referral;
        setReferrals((prev) => {
          if (prev.some((r) => r.id === next.id)) return prev;
          return [next, ...prev];
        });
      } else if (payload.eventType === "UPDATE") {
        const next = payload.new as Referral;
        setReferrals((prev) =>
          prev.map((r) => (r.id === next.id ? next : r)),
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as Partial<Referral>;
        if (!old.id) return;
        setReferrals((prev) => prev.filter((r) => r.id !== old.id));
      }
    },
  );

  return referrals;
}
