"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  inviteUserSchema,
  updateUserDetailsSchema,
  updateUserRolesSchema,
  updateUserStatusSchema,
} from "@/lib/schemas/profiles";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

const USERS_PATH = "/dashboard/admin/users";

async function requireUserManager(): Promise<
  | { ok: true; profile: Profile }
  | { ok: false; error: string }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  if (!hasPermission(profile, "user.invite") && !hasPermission(profile, "user.manage")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }
  return { ok: true, profile };
}

export async function getUsers(): Promise<ActionResult<Profile[]>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  // Admin client bypasses RLS so we can list all profiles regardless of policy
  // (we've already verified the caller is an authorized user manager).
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function inviteUser(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const callerIsSuper = auth.profile.roles.includes("super_admin");

  // Only super_admin can grant the super_admin role.
  if (data.roles.includes("super_admin") && !callerIsSuper) {
    return fail("Only a super admin can invite another super admin.");
  }

  const admin = createAdminClient();

  // Reject if email already exists (active, suspended, or otherwise).
  const { data: existing } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id")
    .eq("email", data.email)
    .maybeSingle();
  if (existing) return fail("A profile with this email already exists.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("profiles")
    .insert({
      email: data.email,
      full_name: data.full_name?.trim() || null,
      roles: data.roles,
      agency: data.agency?.trim() || null,
      status: "active",
      auth_user_id: null,
      invited_by: auth.profile.id,
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "profile",
    entity_id: inserted.id,
    changes: {
      email: data.email,
      roles: data.roles.join(","),
      status: "active",
    },
    user_id: auth.profile.id,
  });

  revalidatePath(USERS_PATH);
  return ok({ id: inserted.id });
}

export async function updateUserRoles(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateUserRolesSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { user_id, roles } = parsed.data;
  const callerIsSuper = auth.profile.roles.includes("super_admin");

  // Only super_admin can grant the super_admin role.
  if (roles.includes("super_admin") && !callerIsSuper) {
    return fail("Only a super admin can grant the super admin role.");
  }

  // Self-protection: cannot demote yourself out of super_admin.
  if (
    user_id === auth.profile.id &&
    callerIsSuper &&
    !roles.includes("super_admin")
  ) {
    return fail("You cannot demote yourself from super admin.");
  }

  const admin = createAdminClient();

  // If target currently has super_admin and the caller is not super_admin, reject.
  const { data: target } = await admin
    .schema("palaro")
    .from("profiles")
    .select("roles")
    .eq("id", user_id)
    .single();
  const targetWasSuper = target?.roles?.includes("super_admin") ?? false;
  if (targetWasSuper && !callerIsSuper) {
    return fail("Only a super admin can change another super admin's roles.");
  }

  const { error } = await admin
    .schema("palaro")
    .from("profiles")
    .update({ roles })
    .eq("id", user_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "profile",
    entity_id: user_id,
    changes: {
      roles: roles.join(","),
      previous_roles: (target?.roles ?? []).join(","),
    },
    user_id: auth.profile.id,
  });

  revalidatePath(USERS_PATH);
  return ok();
}

export async function updateUserStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { user_id, status } = parsed.data;

  if (user_id === auth.profile.id && status === "suspended") {
    return fail("You cannot suspend your own account.");
  }

  const admin = createAdminClient();

  // Only super_admin can suspend another super_admin.
  const { data: target } = await admin
    .schema("palaro")
    .from("profiles")
    .select("roles")
    .eq("id", user_id)
    .single();
  const targetIsSuper = target?.roles?.includes("super_admin") ?? false;
  if (targetIsSuper && !auth.profile.roles.includes("super_admin")) {
    return fail("Only a super admin can change another super admin's status.");
  }

  const { error } = await admin
    .schema("palaro")
    .from("profiles")
    .update({ status })
    .eq("id", user_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "profile",
    entity_id: user_id,
    changes: { status },
    user_id: auth.profile.id,
  });

  revalidatePath(USERS_PATH);
  return ok();
}

export async function updateUserDetails(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateUserDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { user_id, ...rest } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("profiles")
    .update(rest)
    .eq("id", user_id);
  if (error) return fail(error.message);

  const cleanedChanges = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  );
  await recordAudit({
    action: "update",
    entity_type: "profile",
    entity_id: user_id,
    changes: cleanedChanges as Record<string, string | number | boolean | null>,
    user_id: auth.profile.id,
  });

  revalidatePath(USERS_PATH);
  return ok();
}
