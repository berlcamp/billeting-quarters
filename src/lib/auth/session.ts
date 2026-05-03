import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAccess, type Profile } from "./access-check";
import { hasRole, type UserRole } from "@/lib/permissions";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const access = await checkAccess();
  if (access.status === "authorized" || access.status === "suspended") {
    return access.profile;
  }
  return null;
}

// Server-side guard: ensures there's an authenticated user. Redirects to /auth otherwise.
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  return user;
}

// Server-side guard for protected app routes. Redirects based on access state:
//   unauthenticated  → /auth
//   suspended        → /auth/suspended
//   not_authorized   → /auth/not-authorized
//   authorized       → returns the profile
export async function requireActiveProfile(): Promise<Profile> {
  const access = await checkAccess();

  switch (access.status) {
    case "unauthenticated":
      redirect("/auth");
    case "suspended":
      redirect("/auth/suspended");
    case "not_authorized":
      redirect("/auth/not-authorized");
    case "authorized":
      return access.profile;
  }
}

// Server helper for role-gated pages. Returns `{ allowed, profile }` so the page
// can render <Forbidden /> instead of redirecting (per kickoff doc UX guidance).
export async function requireRole(allowedRoles: readonly UserRole[]): Promise<
  | { allowed: true; profile: Profile }
  | { allowed: false; profile: Profile | null }
> {
  const profile = await requireActiveProfile();
  if (!hasRole(profile, allowedRoles)) {
    return { allowed: false, profile };
  }
  return { allowed: true, profile };
}
