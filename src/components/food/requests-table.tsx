"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
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
import { RequestFormDialog } from "./request-form-dialog";
import { deleteRequest, setRequestStatus } from "@/lib/actions/food";
import {
  FOOD_REQUEST_STATUSES,
  FOOD_REQUEST_STATUS_BADGE,
  FOOD_REQUEST_STATUS_LABELS,
  type FoodRequestStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Request = Database["palaro"]["Tables"]["food_requests"]["Row"];
type Supplier = Pick<
  Database["palaro"]["Tables"]["food_suppliers"]["Row"],
  "id" | "name"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const ALL_STATUS = "__all__";

function formatQuantity(q: number): string {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
}

interface Props {
  requests: Request[];
  suppliers: Supplier[];
  bqs: Site[];
  canManage: boolean;
}

function isKnownStatus(s: string): s is FoodRequestStatus {
  return (FOOD_REQUEST_STATUSES as readonly string[]).includes(s);
}

export function RequestsTable({
  requests,
  suppliers,
  bqs,
  canManage,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<
    FoodRequestStatus | typeof ALL_STATUS
  >(ALL_STATUS);

  const supplierMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suppliers) m.set(s.id, s.name);
    return m;
  }, [suppliers]);
  const bqMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bqs) m.set(b.id, b.name);
    return m;
  }, [bqs]);

  const filtered = useMemo(() => {
    if (statusFilter === ALL_STATUS) return requests;
    return requests.filter((r) => r.status === statusFilter);
  }, [requests, statusFilter]);

  async function handleStatus(id: string, status: FoodRequestStatus) {
    const result = await setRequestStatus({ id, status });
    if (result.error) {
      toast.error("Status update failed", { description: result.error });
      return;
    }
    toast.success(`Marked ${FOOD_REQUEST_STATUS_LABELS[status].toLowerCase()}`);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this request?")) return;
    const result = await deleteRequest({ id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Request deleted");
    router.refresh();
  }

  const columns: DataTableColumn<Request>[] = [
    {
      id: "required",
      header: "Required by",
      cell: (r) => (
        <span className="font-mono text-xs">
          {formatManila(r.required_at, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "bq",
      header: "BQ",
      cell: (r) => bqMap.get(r.bq_id) ?? "—",
    },
    {
      id: "item",
      header: "Item",
      cell: (r) => r.item_name || "—",
    },
    {
      id: "qty",
      header: "Quantity",
      cell: (r) => (
        <span className="font-mono text-sm">
          {formatQuantity(r.quantity)} {r.unit}
        </span>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: (r) =>
        r.supplier_id ? (
          (supplierMap.get(r.supplier_id) ?? "—")
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => {
        if (!isKnownStatus(r.status)) {
          return (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              {r.status}
            </Badge>
          );
        }
        return (
          <Badge
            variant="secondary"
            className={cn(
              "border-transparent capitalize",
              FOOD_REQUEST_STATUS_BADGE[r.status],
            )}
          >
            {FOOD_REQUEST_STATUS_LABELS[r.status]}
          </Badge>
        );
      },
    },
  ];

  columns.push({
    id: "actions",
    header: "",
    className: "w-56 text-right",
    cell: (r) => {
      const status = isKnownStatus(r.status) ? r.status : null;
      const finished = status === "delivered" || status === "cancelled";
      return (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {canManage && status === "pending" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatus(r.id, "confirmed")}
            >
              Confirm
            </Button>
          ) : null}
          {canManage && status === "confirmed" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatus(r.id, "delivered")}
            >
              Mark delivered
            </Button>
          ) : null}
          {!finished ? (
            <RequestFormDialog
              request={r}
              bqs={bqs}
              suppliers={suppliers}
              trigger={
                <Button size="icon-sm" variant="ghost" aria-label="Edit">
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
          ) : null}
          {!finished ? (
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
  });

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(r) => r.id}
      pageSize={20}
      searchable={{
        placeholder: "Search BQ, item, supplier…",
        predicate: (r, q) =>
          (bqMap.get(r.bq_id)?.toLowerCase().includes(q) ?? false) ||
          (r.item_name?.toLowerCase().includes(q) ?? false) ||
          (r.unit?.toLowerCase().includes(q) ?? false) ||
          (r.supplier_id
            ? (supplierMap.get(r.supplier_id)?.toLowerCase().includes(q) ??
              false)
            : false),
      }}
      filters={
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as FoodRequestStatus | typeof ALL_STATUS)
          }
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {(v: string | null) => {
                if (!v || v === ALL_STATUS) return "All statuses";
                return FOOD_REQUEST_STATUS_LABELS[v as FoodRequestStatus];
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            {FOOD_REQUEST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {FOOD_REQUEST_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      empty={{
        title: "No requests yet",
        description: "File the first food request to get started.",
      }}
    />
  );
}
