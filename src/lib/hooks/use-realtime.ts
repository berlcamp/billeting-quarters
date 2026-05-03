"use client";

import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimePostgresOptions {
  schema: string;
  table: string;
  event?: PostgresEvent;
  /** Postgres filter, e.g. `status=eq.open`. */
  filter?: string;
}

// Generic Supabase Realtime postgres_changes subscription.
// The handler can change between renders without re-subscribing the channel —
// we sync the latest version through a ref.
export function useRealtimePostgresChanges<
  T extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  options: UseRealtimePostgresOptions,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
) {
  const handlerRef = useRef(onChange);

  // Keep the latest handler accessible without invalidating the subscription.
  useEffect(() => {
    handlerRef.current = onChange;
  });

  const { schema, table, event = "*", filter } = options;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rt-${schema}-${table}-${event}-${filter ?? "all"}`)
      .on(
        // The supabase-js v2 typing for postgres_changes is awkward with custom
        // schemas; the literal channel name + payload works at runtime.
        "postgres_changes" as never,
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          handlerRef.current(payload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schema, table, event, filter]);
}
