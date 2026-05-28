"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { clearWinners } from "@/lib/actions/raffle";
import type { Database } from "@/types/database";

type Winner = Database["palaro"]["Tables"]["raffle_winners"]["Row"];

interface Props {
  winners: Winner[];
  raffleId: string;
  canManage: boolean;
}

function formatManila(iso: string) {
  return format(toZonedTime(new Date(iso), "Asia/Manila"), "MMM d, h:mm a");
}

export function WinnersTable({ winners, raffleId, canManage }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClearAll() {
    startTransition(async () => {
      const res = await clearWinners({ raffle_id: raffleId });
      if (res.error) {
        toast.error("Clear failed", { description: res.error });
        return;
      }
      toast.success(`Removed ${res.data?.deleted ?? 0} winners`);
      setOpen(false);
      router.refresh();
    });
  }

  const columns: DataTableColumn<Winner>[] = [
    {
      id: "draw_index",
      header: "#",
      className: "w-16",
      cell: (w) => (
        <span className="font-mono text-xs text-muted-foreground">
          {w.draw_index}
        </span>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: (w) => (
        <div>
          <span className="flex items-center gap-2 font-medium">
            <Trophy className="size-3.5 text-amber-500" />
            {w.entry_name}
          </span>
          {w.entry_designation ? (
            <span className="ml-5 block text-xs text-muted-foreground">
              {w.entry_designation}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "department",
      header: "Department",
      cell: (w) => w.department_name,
    },
    {
      id: "prize",
      header: "Prize",
      cell: (w) =>
        w.prize_label ? (
          <span className="text-sm">{w.prize_label}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "drawn_at",
      header: "Drawn",
      cell: (w) => (
        <span className="text-xs text-muted-foreground">
          {formatManila(w.drawn_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {winners.length} {winners.length === 1 ? "winner" : "winners"} drawn
          across all sessions.
        </p>
        {canManage && winners.length > 0 ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="text-destructive">
                  <Eraser className="size-3.5" />
                  Clear all winners
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clear all winners?</DialogTitle>
                <DialogDescription>
                  This removes all {winners.length} winner records for this
                  raffle. Entries themselves are not affected. This cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={onClearAll}
                  disabled={pending}
                >
                  Clear all
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
      <DataTable
        data={winners}
        columns={columns}
        rowKey={(w) => w.id}
        searchable={{
          placeholder: "Search winners…",
          predicate: (w, q) =>
            w.entry_name.toLowerCase().includes(q) ||
            w.department_name.toLowerCase().includes(q) ||
            (w.entry_designation?.toLowerCase().includes(q) ?? false),
        }}
        empty={{
          title: "No winners yet",
          description: "Drawn winners will appear here in real time.",
        }}
      />
      {winners.length === 0 ? (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          Open the Draw page and spin to record winners.
        </p>
      ) : null}
    </div>
  );
}
