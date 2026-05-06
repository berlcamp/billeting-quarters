"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "./types";
import type { Database, Json } from "@/types/database";

type AuditLog = Database["palaro"]["Tables"]["audit_logs"]["Row"];

export type AuditAction = "create" | "update" | "delete" | "view" | "login";

export interface AuditEntry {
  action: AuditAction;
  entity_type: string;
  entity_id?: string | null;
  changes?: Json | null;
  user_id?: string | null;
}

// Best-effort audit insert — never throws. Callers should not branch on the
// result; an audit failure must never fail the underlying mutation.
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient();

    let userId = entry.user_id ?? null;
    if (userId === null) {
      const profile = await getCurrentProfile();
      userId = profile?.id ?? null;
    }

    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ipAddress =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null;
      userAgent = h.get("user-agent");
    } catch {
      // headers() unavailable in some contexts (e.g. background jobs) — ignore.
    }

    await admin.schema("palaro").from("audit_logs").insert({
      user_id: userId,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      changes: entry.changes ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch {
    // Swallow — audit is observability, not a correctness gate.
  }
}

// Wraps a server action so a successful result fires an audit log entry.
// The describe() callback receives the action's `data` and must return the
// audit entry (entity_id + changes diff) to record. If the action fails,
// no audit entry is written.
export async function withAuditLog<T>(
  action: () => Promise<ActionResult<T>>,
  describe: (data: T | undefined) => AuditEntry,
): Promise<ActionResult<T>> {
  const result = await action();
  if (result.error === null) {
    await recordAudit(describe(result.data));
  }
  return result;
}

interface AuditWithActor extends AuditLog {
  actor_name: string | null;
  actor_email: string | null;
}

export async function getRecentAuditLogs(
  limit = 20,
): Promise<ActionResult<AuditWithActor[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  const allowed: ReadonlyArray<string> = ["super_admin", "command_center"];
  if (!profile.roles.some((r) => allowed.includes(r))) {
    return fail("You don't have permission to view audit logs.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);

  const rows = data ?? [];
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)),
  );

  let actorMap = new Map<string, { name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .schema("palaro")
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    actorMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        { name: p.full_name, email: p.email },
      ]),
    );
  }

  const enriched: AuditWithActor[] = rows.map((row) => {
    const actor = row.user_id ? actorMap.get(row.user_id) : undefined;
    return {
      ...row,
      actor_name: actor?.name ?? null,
      actor_email: actor?.email ?? null,
    };
  });

  return ok(enriched);
}
