"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GarbageFormDialog } from "./garbage-form-dialog";
import {
  deleteGarbageCollection,
  markGarbageCollected,
  markGarbageMissed,
} from "@/lib/actions/garbage";
import {
  GARBAGE_STATUSES,
  GARBAGE_STATUS_BADGE,
  GARBAGE_STATUS_LABELS,
  type GarbageCollectionStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type GarbageRow = Database["palaro"]["Tables"]["garbage_collections"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const ALL_STATUS = "__all__";

interface Props {
  rows: GarbageRow[];
  sites: Site[];
  canManage: boolean;
}

export function GarbageTable({ rows, sites, canManage }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<
    GarbageCollectionStatus | typeof ALL_STATUS
  >(ALL_STATUS);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  const filtered = useMemo(() => {
    if (statusFilter === ALL_STATUS) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  async function handleCollected(id: string) {
    const result = await markGarbageCollected({ id });
    if (result.error) {
      toast.error("Mark collected failed", { description: result.error });
      return;
    }
    toast.success("Marked collected");
    router.refresh();
  }

  async function handleMissed(id: string) {
    const reason = window.prompt("Reason for miss? (optional)") ?? "";
    const result = await markGarbageMissed({ id, reason: reason || undefined });
    if (result.error) {
      toast.error("Mark missed failed", { description: result.error });
      return;
    }
    toast.success("Marked missed");
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this pickup record?")) return;
    const result = await deleteGarbageCollection({ id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Pickup deleted");
    router.refresh();
  }

  const columns: DataTableColumn<GarbageRow>[] = [
    {
      id: "site",
      header: "Site",
      cell: (r) => (
        <span className="font-medium">{siteMap.get(r.site_id) ?? "—"}</span>
      ),
    },
    {
      id: "scheduled",
      header: "Scheduled",
      cell: (r) => (
        <span className="font-mono text-xs">
          {formatManila(r.scheduled_at, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "collected",
      header: "Collected",
      cell: (r) =>
        r.collected_at ? (
          <span className="font-mono text-xs">
            {formatManila(r.collected_at, "MMM d · HH:mm")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "collector",
      header: "Collector",
      cell: (r) =>
        r.collector_name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant="secondary"
          className={cn(
            "border-transparent capitalize",
            GARBAGE_STATUS_BADGE[r.status as GarbageCollectionStatus],
          )}
        >
          {GARBAGE_STATUS_LABELS[r.status as GarbageCollectionStatus]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-44 text-right",
      cell: (r) => {
        const finished =
          r.status === "collected" || r.status === "missed";
        return (
          <div className="flex items-center justify-end gap-1">
            {!finished ? (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Mark collected"
                  onClick={() => handleCollected(r.id)}
                >
                  <CheckCircle2 className="size-3.5 text-green-700" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Mark missed"
                  onClick={() => handleMissed(r.id)}
                >
                  <XCircle className="size-3.5 text-red-700" />
                </Button>
              </>
            ) : null}
            {canManage && !finished ? (
              <GarbageFormDialog
                row={r}
                sites={sites}
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label="Edit">
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
            ) : null}
            {canManage ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Delete"
                onClick={() => handleDelete(r.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(r) => r.id}
      pageSize={20}
      searchable={{
        placeholder: "Search site, collector…",
        predicate: (r, q) =>
          (siteMap.get(r.site_id)?.toLowerCase().includes(q) ?? false) ||
          (r.collector_name?.toLowerCase().includes(q) ?? false),
      }}
      filters={
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as GarbageCollectionStatus | typeof ALL_STATUS)
          }
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {(v: string | null) => {
                if (!v || v === ALL_STATUS) return "All statuses";
                return GARBAGE_STATUS_LABELS[v as GarbageCollectionStatus];
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            {GARBAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {GARBAGE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      empty={{
        title: "No pickups scheduled",
        description: "Schedule the first pickup to start tracking collection.",
      }}
    />
  );
}
