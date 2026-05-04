import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

export type AccessState =
  | { status: "authorized"; profile: Profile }
  | { status: "suspended"; profile: Profile }
  | { status: "not_authorized"; email: string }
  | { status: "unauthenticated" };

// Resolves the current request's access state by joining the Supabase auth user
// to their palaro.profiles row. The DB trigger guarantees that any auth user has
// a corresponding profile (or the OAuth flow is rejected before auth.users is
// inserted), so a missing profile here is a defensive edge case.
//
// Wrapped in React.cache so layout + page + every server action in the same
// render share a single auth.getUser() + profiles SELECT instead of repeating
// them. Cache scope is one request render — never crosses requests.
export const checkAccess = cache(async (): Promise<AccessState> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data: profile } = await supabase
    .schema("palaro")
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile) {
    return { status: "not_authorized", email: user.email ?? "" };
  }

  if (profile.status === "suspended") {
    return { status: "suspended", profile };
  }

  if (profile.status !== "active" || !profile.role) {
    return { status: "not_authorized", email: profile.email };
  }

  return { status: "authorized", profile };
});
