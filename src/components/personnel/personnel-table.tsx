"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PersonnelDialog } from "./personnel-dialog";
import { deletePersonnel, reactivatePersonnel } from "@/lib/actions/personnel";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  personnel: Personnel[];
  sites: Site[];
}

const ALL = "all";
type StatusFilter = "all" | "active" | "inactive";

export function PersonnelTable({ personnel, sites }: Props) {
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [stableEditing, setStableEditing] = useState<Personnel | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Personnel | null>(null);
  const [reactivatingTarget, setReactivatingTarget] =
    useState<Personnel | null>(null);
  const [committeeFilter, setCommitteeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const router = useRouter();

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  const committees = useMemo(() => {
    const set = new Set<string>();
    for (const p of personnel) if (p.committee) set.add(p.committee);
    return Array.from(set).sort();
  }, [personnel]);

  const filtered = useMemo(() => {
    return personnel.filter((p) => {
      if (committeeFilter !== ALL && p.committee !== committeeFilter)
        return false;
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      return true;
    });
  }, [personnel, committeeFilter, statusFilter]);

  async function handleDelete() {
    if (!deletingTarget) return;
    const result = await deletePersonnel({ id: deletingTarget.id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success(`${deletingTarget.full_name} archived`);
    setDeletingTarget(null);
    router.refresh();
  }

  async function handleReactivate() {
    if (!reactivatingTarget) return;
    const result = await reactivatePersonnel({ id: reactivatingTarget.id });
    if (result.error) {
      toast.error("Reactivate failed", { description: result.error });
      return;
    }
    toast.success(`${reactivatingTarget.full_name} reactivated`);
    setReactivatingTarget(null);
    router.refresh();
  }

  const columns: DataTableColumn<Personnel>[] = [
    {
      id: "full_name",
      header: "Name",
      cell: (p) => (
        <div>
          <div className="font-medium">{p.full_name}</div>
          {p.designation ? (
            <div className="text-xs text-muted-foreground">{p.designation}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "committee",
      header: "Committee",
      cell: (p) => p.committee,
    },
    {
      id: "assignment",
      header: "Site / Area",
      cell: (p) => (
        <div className="text-sm">
          <div>{p.site_id ? (siteMap.get(p.site_id) ?? "—") : "—"}</div>
          {p.area_assigned ? (
            <div className="text-xs text-muted-foreground">
              {p.area_assigned}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "agency",
      header: "Agency",
      cell: (p) => p.agency ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "contact",
      header: "Contact",
      cell: (p) =>
        p.contact_number ? (
          <span className="font-mono text-xs">{p.contact_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (p) =>
        p.is_active ? (
          <Badge variant="secondary">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Inactive
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (p) =>
        p.is_active ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingTarget(p);
            }}
            aria-label={`Archive ${p.full_name}`}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setReactivatingTarget(p);
            }}
            aria-label={`Reactivate ${p.full_name}`}
          >
            <RotateCcw className="size-4 text-muted-foreground" />
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(p) => p.id}
        searchable={{
          placeholder: "Search by name, committee, agency…",
          predicate: (p, q) =>
            p.full_name.toLowerCase().includes(q) ||
            p.committee.toLowerCase().includes(q) ||
            (p.designation?.toLowerCase().includes(q) ?? false) ||
            (p.agency?.toLowerCase().includes(q) ?? false),
        }}
        filters={
          <>
            <Select
              value={committeeFilter}
              onValueChange={(v) => setCommitteeFilter(v ?? ALL)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === ALL ? "All committees" : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All committees</SelectItem>
                {committees.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter((v as StatusFilter) ?? "all")
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(v: string | null) =>
                    v === "active"
                      ? "Active"
                      : v === "inactive"
                        ? "Inactive"
                        : "All statuses"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        empty={{
          title: "No personnel yet",
          description:
            "Add personnel to issue ID cards, capture attendance, and generate DTRs.",
        }}
        onRowClick={(p) => {
          setStableEditing(p);
          setEditing(p);
        }}
      />
      {stableEditing && (
        <PersonnelDialog
          personnel={stableEditing}
          sites={sites}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onOpenChangeComplete={(o) => !o && setStableEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deletingTarget}
        onOpenChange={(o) => !o && setDeletingTarget(null)}
        title="Archive this personnel?"
        description={
          deletingTarget ? (
            <>
              <span className="font-medium">{deletingTarget.full_name}</span>{" "}
              will be set inactive and hidden from ID, DTR, and attendance
              pickers. Past attendance logs are preserved.
            </>
          ) : null
        }
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={!!reactivatingTarget}
        onOpenChange={(o) => !o && setReactivatingTarget(null)}
        title="Reactivate this personnel?"
        description={
          reactivatingTarget ? (
            <>
              <span className="font-medium">
                {reactivatingTarget.full_name}
              </span>{" "}
              will be set active again and reappear in ID, DTR, and attendance
              pickers.
            </>
          ) : null
        }
        confirmLabel="Reactivate"
        onConfirm={handleReactivate}
      />
    </>
  );
}
