"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck, MapPin, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EventFormDialog } from "./event-form-dialog";
import { deleteEvent } from "@/lib/actions/event-attendance";
import type { EventWithCount } from "@/lib/actions/event-attendance";
import { formatManila } from "@/lib/timezone";

interface Props {
  events: EventWithCount[];
  canManage: boolean;
}

export function EventsList({ events, canManage }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(event: EventWithCount) {
    if (
      !window.confirm(
        `Delete "${event.name}"? Its attendance history is kept but the event is hidden.`,
      )
    ) {
      return;
    }
    setDeletingId(event.id);
    const result = await deleteEvent({ id: event.id });
    setDeletingId(null);
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Event deleted");
    router.refresh();
  }

  if (events.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarCheck className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="font-semibold">No events yet</h3>
            <p className="text-sm text-muted-foreground">
              Create an event to start logging time-in attendance.
            </p>
          </div>
          {canManage ? <EventFormDialog /> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <Card key={e.id} className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-start justify-between gap-2">
              <span className="line-clamp-2">{e.name}</span>
              <CalendarCheck className="size-4 shrink-0 text-primary" />
            </CardTitle>
            <div className="space-y-1 text-sm text-muted-foreground">
              {e.event_date ? (
                <p>{formatManila(e.event_date)}</p>
              ) : null}
              {e.location ? (
                <p className="flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="line-clamp-1">{e.location}</span>
                </p>
              ) : null}
              <p className="flex items-center gap-1">
                <Users className="size-3.5 shrink-0" />
                {e.attendance_count} checked in
              </p>
            </div>
          </CardHeader>
          <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
            <div className="flex items-center gap-1">
              {canManage ? <EventFormDialog event={e} /> : null}
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={deletingId === e.id}
                  onClick={() => handleDelete(e)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <Link
              href={`/dashboard/personnel/event-attendance/${e.id}`}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Open
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
