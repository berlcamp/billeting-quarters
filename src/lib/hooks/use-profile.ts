"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { useAuth } from "./use-auth";

export type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

type FetchedFor = { authUserId: string; profile: Profile | null };

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const [fetched, setFetched] = useState<FetchedFor | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    let mounted = true;
    const supabase = createClient();

    supabase
      .schema("palaro")
      .from("profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!mounted) return;
        setFetched({ authUserId: user.id, profile: data });
      });

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  // Derive state synchronously each render — avoids resetting via setState
  // when `user` changes (and the React 19 rule against sync setState in effects).
  const profile =
    user && fetched?.authUserId === user.id ? fetched.profile : null;
  const loading =
    authLoading || (!!user && fetched?.authUserId !== user.id);

  return { profile, loading };
}
