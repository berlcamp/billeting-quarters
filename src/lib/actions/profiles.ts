"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  inviteUserSchema,
  updateUserDetailsSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "@/lib/schemas/profiles";
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

  // Only super_admin can grant the super_admin role.
  if (data.role === "super_admin" && auth.profile.role !== "super_admin") {
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
      role: data.role,
      agency: data.agency?.trim() || null,
      status: "active",
      auth_user_id: null,
      invited_by: auth.profile.id,
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  revalidatePath(USERS_PATH);
  return ok({ id: inserted.id });
}

export async function updateUserRole(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireUserManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { user_id, role } = parsed.data;

  // Only super_admin can promote anyone to super_admin.
  if (role === "super_admin" && auth.profile.role !== "super_admin") {
    return fail("Only a super admin can grant the super admin role.");
  }

  // Self-protection: cannot demote yourself out of super_admin.
  if (user_id === auth.profile.id && auth.profile.role === "super_admin" && role !== "super_admin") {
    return fail("You cannot demote yourself from super admin.");
  }

  const admin = createAdminClient();

  // If target is currently super_admin and we're not super_admin, reject.
  const { data: target } = await admin
    .schema("palaro")
    .from("profiles")
    .select("role")
    .eq("id", user_id)
    .single();
  if (target?.role === "super_admin" && auth.profile.role !== "super_admin") {
    return fail("Only a super admin can change another super admin's role.");
  }

  const { error } = await admin
    .schema("palaro")
    .from("profiles")
    .update({ role })
    .eq("id", user_id);
  if (error) return fail(error.message);

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
    .select("role")
    .eq("id", user_id)
    .single();
  if (target?.role === "super_admin" && auth.profile.role !== "super_admin") {
    return fail("Only a super admin can change another super admin's status.");
  }

  const { error } = await admin
    .schema("palaro")
    .from("profiles")
    .update({ status })
    .eq("id", user_id);
  if (error) return fail(error.message);

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

  revalidatePath(USERS_PATH);
  return ok();
}
