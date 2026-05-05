"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CollectorDialog } from "./collector-dialog";
import { deleteGarbageCollector } from "@/lib/actions/garbage";
import type { Database } from "@/types/database";

type Collector = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];

interface Props {
  collectors: Collector[];
}

export function CollectorsTable({ collectors }: Props) {
  const [editing, setEditing] = useState<Collector | null>(null);
  const [stableEditing, setStableEditing] = useState<Collector | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Collector | null>(null);
  const router = useRouter();

  async function handleDelete() {
    if (!deletingTarget) return;
    const result = await deleteGarbageCollector({ id: deletingTarget.id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success(`${deletingTarget.swm_coordinator_name} removed`);
    setDeletingTarget(null);
    router.refresh();
  }

  const columns: DataTableColumn<Collector>[] = [
    {
      id: "swm_coordinator",
      header: "SWM Coordinator",
      cell: (c) => (
        <span className="font-medium">{c.swm_coordinator_name}</span>
      ),
    },
    {
      id: "city_enro_coordinator",
      header: "City ENRO Coordinator",
      cell: (c) =>
        c.city_enro_coordinator_name ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "driver",
      header: "Driver",
      cell: (c) =>
        c.driver_name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (c) =>
        c.vehicle_description ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (c) =>
        c.contact_number ? (
          <span className="font-mono text-xs">{c.contact_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (c) =>
        c.is_active ? (
          <Badge variant="secondary" className="border-transparent bg-green-100 text-green-800">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary" className="border-transparent bg-muted text-muted-foreground">
            Inactive
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (c) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setDeletingTarget(c);
          }}
          aria-label={`Remove ${c.swm_coordinator_name}`}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={collectors}
        columns={columns}
        rowKey={(c) => c.id}
        searchable={{
          placeholder: "Search by name, vehicle, contact…",
          predicate: (c, q) =>
            c.swm_coordinator_name.toLowerCase().includes(q) ||
            (c.city_enro_coordinator_name?.toLowerCase().includes(q) ?? false) ||
            (c.driver_name?.toLowerCase().includes(q) ?? false) ||
            (c.vehicle_description?.toLowerCase().includes(q) ?? false) ||
            (c.contact_number?.toLowerCase().includes(q) ?? false),
        }}
        empty={{
          title: "No collectors yet",
          description:
            "Add a collector before scheduling pickups. The schedule rules link to these.",
        }}
        onRowClick={(c) => {
          setStableEditing(c);
          setEditing(c);
        }}
      />
      {stableEditing && (
        <CollectorDialog
          collector={stableEditing}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              setStableEditing(null);
            }
          }}
        />
      )}
      <ConfirmDialog
        open={!!deletingTarget}
        onOpenChange={(o) => !o && setDeletingTarget(null)}
        title="Remove this collector?"
        description={
          deletingTarget ? (
            <>
              <span className="font-medium">
                {deletingTarget.swm_coordinator_name}
              </span>{" "}
              and any of their schedule rules will be removed. Already-generated
              pickups stay in history.
            </>
          ) : null
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
