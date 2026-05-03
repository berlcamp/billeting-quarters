"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { LiveBadge } from "@/components/shared/live-badge";
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime-notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Notification = Database["palaro"]["Tables"]["notifications"]["Row"];

interface NotificationsTableProps {
  initial: Notification[];
  profileId: string;
  role: UserRole | null;
}

type ReadFilter = "all" | "unread" | "read";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  incident: "Incident",
  referral: "Referral",
  vip: "VIP",
  heat_index: "Heat index",
  system: "System",
};

export function NotificationsTable({
  initial,
  profileId,
  role,
}: NotificationsTableProps) {
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const router = useRouter();

  const notifications = useRealtimeNotifications(initial, {
    profileId,
    role,
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) set.add(n.category);
    return Array.from(set).sort();
  }, [notifications]);

  const severities = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) if (n.severity) set.add(n.severity);
    return Array.from(set).sort();
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
      if (severityFilter !== "all" && n.severity !== severityFilter) return false;
      if (readFilter === "unread" && n.is_read) return false;
      if (readFilter === "read" && !n.is_read) return false;
      return true;
    });
  }, [notifications, categoryFilter, severityFilter, readFilter]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleMarkRead(n: Notification, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = await markNotificationRead({ id: n.id });
    if (result.error) {
      toast.error("Could not mark read", { description: result.error });
    }
  }

  async function handleMarkAll() {
    setBusy(true);
    const result = await markAllNotificationsRead();
    setBusy(false);
    if (result.error) {
      toast.error("Could not mark all read", { description: result.error });
      return;
    }
    toast.success("All notifications marked read");
  }

  const columns: DataTableColumn<Notification>[] = [
    {
      id: "indicator",
      header: "",
      className: "w-6",
      cell: (row) =>
        !row.is_read ? (
          <span
            aria-label="Unread"
            className="inline-block size-2 rounded-full bg-primary"
          />
        ) : null,
    },
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <div className="min-w-0 space-y-1">
          <div
            className={cn(
              "text-sm line-clamp-1",
              !row.is_read && "font-medium",
            )}
          >
            {row.title}
          </div>
          {row.body ? (
            <div className="text-xs text-muted-foreground line-clamp-2">
              {row.body}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      className: "w-28",
      cell: (row) => (
        <Badge
          variant="outline"
          className="text-[10px] uppercase tracking-wider"
        >
          {CATEGORY_LABEL[row.category] ?? row.category}
        </Badge>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      className: "w-24",
      cell: (row) =>
        row.severity ? (
          <Badge
            variant="secondary"
            className={cn(
              "rounded-full border-transparent capitalize",
              SEVERITY_BADGE[row.severity] ??
                "bg-muted text-muted-foreground",
            )}
          >
            {row.severity}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "received",
      header: "Received",
      className: "w-36",
      cell: (row) => (
        <div className="text-xs text-muted-foreground tabular-nums space-y-0.5">
          <div>
            {formatDistanceToNow(new Date(row.created_at), {
              addSuffix: true,
            })}
          </div>
          <div className="font-mono text-[10px]">
            {format(new Date(row.created_at), "MMM d, HH:mm")}
          </div>
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (row) =>
        !row.is_read ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => handleMarkRead(row, e)}
          >
            Mark read
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LiveBadge label="Live" />
        {unreadCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={busy}
          >
            <CheckCheck className="size-4" />
            {busy ? "Marking…" : `Mark all read (${unreadCount})`}
          </Button>
        ) : null}
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search title or body…",
          predicate: (row, q) =>
            row.title.toLowerCase().includes(q) ||
            (row.body ?? "").toLowerCase().includes(q),
        }}
        filters={
          <>
            <Select
              value={readFilter}
              onValueChange={(v) => setReadFilter((v ?? "all") as ReadFilter)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue>
                  {(v: string | null) =>
                    v === "unread"
                      ? "Unread only"
                      : v === "read"
                        ? "Read only"
                        : "All"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread only</SelectItem>
                <SelectItem value="read">Read only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v ?? "all")}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === "all"
                      ? "All categories"
                      : (CATEGORY_LABEL[v] ?? v)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {severities.length > 0 ? (
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v ?? "all")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue>
                    {(v: string | null) =>
                      !v || v === "all"
                        ? "All severities"
                        : v.charAt(0).toUpperCase() + v.slice(1)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {severities.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        }
        empty={{
          title: "No notifications",
          description:
            readFilter === "unread"
              ? "You're all caught up."
              : "Nothing has been sent your way yet.",
        }}
        onRowClick={(row) => {
          if (row.link_url) router.push(row.link_url);
        }}
      />
      <p className="text-xs text-muted-foreground">
        Tap a notification to open it. <Link href="/dashboard" className="underline-offset-2 hover:underline">Back to Command Center</Link>.
      </p>
    </div>
  );
}
