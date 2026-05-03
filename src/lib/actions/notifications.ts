"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Notification = Database["palaro"]["Tables"]["notifications"]["Row"];

const NOTIFICATIONS_PATH = "/dashboard/notifications";

// Returns notifications addressed to the current user (by id) OR to their role.
export async function getMyNotifications(
  limit = 100,
): Promise<ActionResult<Notification[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const orFilter = profile.role
    ? `recipient_id.eq.${profile.id},recipient_role.eq.${profile.role}`
    : `recipient_id.eq.${profile.id}`;

  const { data, error } = await admin
    .schema("palaro")
    .from("notifications")
    .select("*")
    .or(orFilter)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

const markReadSchema = z.object({ id: z.string().uuid() });

export async function markNotificationRead(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const parsed = markReadSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  // For v1, broadcast notifications (recipient_role) get marked read globally.
  // Per-user read tracking would need a separate notification_reads table.
  const { error } = await admin
    .schema("palaro")
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  revalidatePath(NOTIFICATIONS_PATH);
  return ok();
}

export async function markAllNotificationsRead(): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  // Mark unread notifications addressed to me (id) or my role.
  let query = admin
    .schema("palaro")
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);

  query = profile.role
    ? query.or(`recipient_id.eq.${profile.id},recipient_role.eq.${profile.role}`)
    : query.eq("recipient_id", profile.id);

  const { error } = await query;
  if (error) return fail(error.message);

  revalidatePath(NOTIFICATIONS_PATH);
  return ok();
}
