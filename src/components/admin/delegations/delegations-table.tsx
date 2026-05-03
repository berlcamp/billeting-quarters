"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DelegationDialog } from "./delegation-dialog";
import { deleteDelegation } from "@/lib/actions/delegations";
import type { Database } from "@/types/database";

type Delegation = Database["palaro"]["Tables"]["delegations"]["Row"];
type Site = Database["palaro"]["Tables"]["sites"]["Row"];

interface DelegationsTableProps {
  delegations: Delegation[];
  bqSites: Pick<Site, "id" | "name">[];
}

export function DelegationsTable({ delegations, bqSites }: DelegationsTableProps) {
  const [editing, setEditing] = useState<Delegation | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Delegation | null>(null);
  const router = useRouter();

  const bqLookup = useMemo(() => {
    const m = new Map<string, string>();
    bqSites.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [bqSites]);

  async function handleDelete() {
    if (!deletingTarget) return;
    const result = await deleteDelegation({ id: deletingTarget.id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success(`${deletingTarget.region_code} archived`);
    setDeletingTarget(null);
    router.refresh();
  }

  const columns: DataTableColumn<Delegation>[] = [
    {
      id: "code",
      header: "Code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.color_hex ? (
            <span
              className="size-3 rounded-full ring-1 ring-border"
              style={{ backgroundColor: row.color_hex }}
              aria-hidden
            />
          ) : null}
          <span className="font-mono text-sm font-medium">{row.region_code}</span>
        </div>
      ),
      className: "w-32",
    },
    {
      id: "name",
      header: "Region",
      cell: (row) => (
        <div className="text-sm">
          <div>{row.region_name}</div>
          {row.short_name && row.short_name !== row.region_code ? (
            <div className="text-xs text-muted-foreground">{row.short_name}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "head",
      header: "Head of delegation",
      cell: (row) => (
        <div className="text-sm">
          <div>{row.head_of_delegation ?? "—"}</div>
          {row.contact_number ? (
            <div className="text-xs text-muted-foreground font-mono">
              {row.contact_number}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "athletes",
      header: "Roster",
      cell: (row) => (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>
            <span className="font-mono tabular-nums text-foreground">
              {row.total_athletes ?? 0}
            </span>{" "}
            athletes
          </div>
          <div>
            {row.total_coaches ?? 0} coaches · {row.total_officials ?? 0} officials
          </div>
        </div>
      ),
      className: "w-40",
    },
    {
      id: "bq",
      header: "BQ assigned",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.assigned_bq_id
            ? (bqLookup.get(row.assigned_bq_id) ?? "—")
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setDeletingTarget(row);
          }}
          aria-label={`Delete ${row.region_code}`}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={delegations}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search by region or head…",
          predicate: (row, q) =>
            row.region_code.toLowerCase().includes(q) ||
            row.region_name.toLowerCase().includes(q) ||
            (row.head_of_delegation ?? "").toLowerCase().includes(q),
        }}
        empty={{
          title: "No delegations yet",
          description:
            "Add the 17 PH regions. Run the seed file in supabase/seed.sql to bulk-insert them.",
        }}
        onRowClick={(row) => setEditing(row)}
      />
      <DelegationDialog
        delegation={editing}
        bqSites={bqSites}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <ConfirmDialog
        open={!!deletingTarget}
        onOpenChange={(o) => !o && setDeletingTarget(null)}
        title="Archive this delegation?"
        description={
          deletingTarget ? (
            <>
              <span className="font-medium">{deletingTarget.region_code}</span> —{" "}
              {deletingTarget.region_name}. This is a soft delete; references
              from incidents and referrals are preserved.
            </>
          ) : null
        }
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
