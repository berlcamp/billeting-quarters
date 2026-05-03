import { TimelineLog, type TimelineEntry } from "@/components/shared/timeline-log";
import type { Database } from "@/types/database";

type AuditLog = Database["palaro"]["Tables"]["audit_logs"]["Row"] & {
  actor_name: string | null;
  actor_email: string | null;
};

const ACTION_DOT: Record<string, string> = {
  create: "text-green-600",
  update: "text-blue-600",
  delete: "text-red-600",
  view: "text-muted-foreground",
  login: "text-violet-600",
};

interface Props {
  entries: AuditLog[];
}

export function RecentAuditLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No audited actions recorded yet.
      </div>
    );
  }

  const items: TimelineEntry[] = entries.map((row) => ({
    id: row.id,
    at: row.created_at,
    title: (
      <span>
        <span className="font-medium capitalize">{row.action}</span>{" "}
        <span className="text-muted-foreground">on</span>{" "}
        <span className="font-mono text-xs">{row.entity_type}</span>
        {row.entity_id ? (
          <span className="text-muted-foreground"> · {row.entity_id.slice(0, 8)}</span>
        ) : null}
      </span>
    ),
    description: (
      <span>
        {row.actor_name ?? row.actor_email ?? "System"}
        {row.actor_email && row.actor_name ? ` · ${row.actor_email}` : null}
      </span>
    ),
    dotClassName: ACTION_DOT[row.action] ?? "text-muted-foreground",
  }));

  return <TimelineLog entries={items} />;
}
