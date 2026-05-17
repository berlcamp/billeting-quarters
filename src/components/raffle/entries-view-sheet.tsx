"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearDepartmentEntries,
  deleteEntry,
  getEntriesForDepartment,
} from "@/lib/actions/raffle";
import type { Database } from "@/types/database";

type Entry = Database["palaro"]["Tables"]["raffle_entries"]["Row"];

interface Props {
  departmentId: string;
  departmentName: string;
  canManage: boolean;
  trigger: ReactNode;
}

export function EntriesViewSheet({
  departmentId,
  departmentName,
  canManage,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  // null = "not loaded yet" so we can show a loading state without having to
  // synchronously setState inside the fetch effect.
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [clearOpen, setClearOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getEntriesForDepartment(departmentId).then((res) => {
      if (cancelled) return;
      if (res.error) {
        toast.error("Failed to load entries", { description: res.error });
        setEntries([]);
      } else {
        setEntries(res.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, departmentId]);

  function onDeleteEntry(id: string) {
    startTransition(async () => {
      const res = await deleteEntry({ id });
      if (res.error) {
        toast.error("Delete failed", { description: res.error });
        return;
      }
      setEntries((prev) => (prev ?? []).filter((e) => e.id !== id));
      router.refresh();
    });
  }

  function onClearAll() {
    startTransition(async () => {
      const res = await clearDepartmentEntries({
        department_id: departmentId,
      });
      if (res.error) {
        toast.error("Clear failed", { description: res.error });
        return;
      }
      toast.success(`Removed ${res.data?.deleted ?? 0} entries`);
      setEntries([]);
      setClearOpen(false);
      router.refresh();
    });
  }

  const loading = entries === null;
  const list = entries ?? [];

  const filtered = query.trim()
    ? list.filter((e) =>
        e.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : list;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{departmentName}</SheetTitle>
          <SheetDescription>
            {list.length} {list.length === 1 ? "entry" : "entries"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-4">
          <Input
            placeholder="Search names…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {canManage && list.length > 0 ? (
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive"
                    title="Clear all entries"
                  >
                    <Eraser className="size-4" />
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Clear all entries?</DialogTitle>
                  <DialogDescription>
                    This removes all {list.length} entries from{" "}
                    <span className="font-medium">{departmentName}</span>. This
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setClearOpen(false)}
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

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {list.length === 0
                ? "No entries yet. Use “Add names” to populate."
                : "No matches."}
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="line-clamp-1">{e.name}</span>
                  {canManage ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDeleteEntry(e.id)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
