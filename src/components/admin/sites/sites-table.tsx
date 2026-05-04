"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SiteDialog } from "./site-dialog";
import { deleteSite } from "@/lib/actions/sites";
import { SITE_TYPES, SITE_TYPE_LABELS, type SiteType } from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Database["palaro"]["Tables"]["sites"]["Row"];

interface SitesTableProps {
  sites: Site[];
}

export function SitesTable({ sites }: SitesTableProps) {
  const [editing, setEditing] = useState<Site | null>(null);
  const [stableEditing, setStableEditing] = useState<Site | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Site | null>(null);
  const [typeFilter, setTypeFilter] = useState<SiteType | "all">("all");
  const router = useRouter();

  const filtered = useMemo(() => {
    return sites.filter((s) => typeFilter === "all" || s.site_type === typeFilter);
  }, [sites, typeFilter]);

  async function handleDelete() {
    if (!deletingTarget) return;
    const result = await deleteSite({ id: deletingTarget.id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success(`${deletingTarget.name} removed`);
    setDeletingTarget(null);
    router.refresh();
  }

  const columns: DataTableColumn<Site>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {SITE_TYPE_LABELS[row.site_type]}
        </span>
      ),
    },
    {
      id: "address",
      header: "Address",
      cell: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.address ?? "—"}
        </span>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (row) => (
        <div className="text-sm">
          <div>{row.contact_person ?? "—"}</div>
          {row.contact_number ? (
            <div className="text-xs text-muted-foreground font-mono">
              {row.contact_number}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "capacity",
      header: "Capacity",
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {row.capacity ?? "—"}
        </span>
      ),
      className: "w-24 text-right",
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
          aria-label={`Delete ${row.name}`}
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search by name or address…",
          predicate: (row, q) =>
            row.name.toLowerCase().includes(q) ||
            (row.address ?? "").toLowerCase().includes(q),
        }}
        filters={
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as SiteType | "all")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                {(v: string | null) =>
                  !v || v === "all"
                    ? "All types"
                    : v in SITE_TYPE_LABELS
                      ? SITE_TYPE_LABELS[v as SiteType]
                      : v
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {SITE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SITE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        empty={{
          title: "No sites yet",
          description: "Add your first BQ, Playing Venue, UCF, hospital, or clinic.",
        }}
        onRowClick={(row) => { setStableEditing(row); setEditing(row); }}
      />
      {stableEditing && (
        <SiteDialog
          site={stableEditing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onOpenChangeComplete={(o) => !o && setStableEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deletingTarget}
        onOpenChange={(o) => !o && setDeletingTarget(null)}
        title="Remove this site?"
        description={
          deletingTarget ? (
            <>
              <span className="font-medium">{deletingTarget.name}</span> will be
              archived (soft delete) and hidden from the active list. References
              from incidents and referrals are preserved.
            </>
          ) : null
        }
        confirmLabel="Remove site"
        variant="destructive"
        onConfirm={handleDelete}
      />
      {/* Empty-state CTA fallback when nothing matches the type filter */}
      {sites.length > 0 && filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No sites match the selected filter. <Building2 className="inline size-4" />
        </div>
      ) : null}
    </>
  );
}
