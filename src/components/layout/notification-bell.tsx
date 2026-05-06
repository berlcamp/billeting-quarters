"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, AlertOctagon, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime-notifications";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/permissions";
import type { Database } from "@/types/database";

type Notification = Database["palaro"]["Tables"]["notifications"]["Row"];

interface NotificationBellProps {
  profileId: string;
  roles: readonly UserRole[];
}

const SEVERITY_ACCENT: Record<string, string> = {
  critical: "border-l-red-500",
  warning: "border-l-yellow-500",
  info: "border-l-blue-500",
};

export function NotificationBell({ profileId, roles }: NotificationBellProps) {
  const [initial, setInitial] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Fetch the initial 50 on mount; realtime takes over after that.
  useEffect(() => {
    let mounted = true;
    getMyNotifications(50).then((result) => {
      if (!mounted) return;
      if (!result.error) setInitial(result.data ?? []);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const notifications = useRealtimeNotifications(initial, {
    profileId,
    roles,
    onCritical: (n) => {
      toast.error(n.title, {
        description: n.body ?? undefined,
        icon: <AlertOctagon className="size-4" />,
        duration: 10_000,
        action: n.link_url
          ? {
              label: "Open",
              onClick: () => router.push(n.link_url!),
            }
          : undefined,
      });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );
  const visible = notifications.slice(0, 20);

  async function handleMarkRead(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = await markNotificationRead({ id });
    if (result.error) {
      toast.error("Could not mark read", { description: result.error });
    }
  }

  async function handleMarkAll() {
    const result = await markAllNotificationsRead();
    if (result.error) {
      toast.error("Could not mark all read", { description: result.error });
      return;
    }
    toast.success("All notifications marked read");
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${
              unreadCount > 0 ? ` (${unreadCount} unread)` : ""
            }`}
            className="relative"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <ul className="max-h-[420px] overflow-y-auto divide-y">
            {visible.map((n) => {
              const accent =
                SEVERITY_ACCENT[n.severity ?? ""] ?? "border-l-transparent";
              const itemClass = cn(
                "block px-3 py-2.5 border-l-4 hover:bg-accent/40 transition-colors",
                accent,
                !n.is_read && "bg-accent/20",
              );
              const body = (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          !n.is_read && "font-medium",
                        )}
                      >
                        {n.title}
                      </span>
                      {!n.is_read ? (
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full bg-primary"
                        />
                      ) : null}
                    </div>
                    {n.body ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(n.id, e)}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Mark as read"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link_url ? (
                    <Link
                      href={n.link_url}
                      onClick={() => setOpen(false)}
                      className={itemClass}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={itemClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t px-3 py-2">
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all notifications →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
