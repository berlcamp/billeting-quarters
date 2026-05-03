"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { DutyFormDialog } from "./duty-form-dialog";
import { deleteDuty } from "@/lib/actions/personnel";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Duty = Database["palaro"]["Tables"]["duty_schedules"]["Row"];
type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  duties: Duty[];
  personnel: Profile[];
  sites: Site[];
}

export function DutyTable({ duties, personnel, sites }: Props) {
  const router = useRouter();

  const personnelMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of personnel) m.set(p.id, p);
    return m;
  }, [personnel]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;
    const result = await deleteDuty({ id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Shift deleted");
    router.refresh();
  }

  const columns: DataTableColumn<Duty>[] = [
    {
      id: "personnel",
      header: "Personnel",
      cell: (d) => {
        const p = personnelMap.get(d.personnel_id);
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {p?.full_name ?? p?.email ?? "Unknown"}
            </span>
            {p?.agency ? (
              <span className="text-xs text-muted-foreground">{p.agency}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "site",
      header: "Site",
      cell: (d) =>
        d.site_id ? (
          siteMap.get(d.site_id) ?? "—"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "start",
      header: "Start",
      cell: (d) => (
        <span className="font-mono text-xs">
          {formatManila(d.duty_start, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "end",
      header: "End",
      cell: (d) => (
        <span className="font-mono text-xs">
          {formatManila(d.duty_end, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "label",
      header: "Shift",
      cell: (d) => d.shift_label ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "actions",
      header: "",
      className: "w-24",
      cell: (d) => (
        <div className="flex items-center gap-1">
          <DutyFormDialog
            personnel={personnel}
            sites={sites}
            duty={d}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Edit shift">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete shift"
            onClick={() => handleDelete(d.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={duties}
      columns={columns}
      rowKey={(d) => d.id}
      pageSize={20}
      searchable={{
        placeholder: "Search by name, label…",
        predicate: (d, q) => {
          const p = personnelMap.get(d.personnel_id);
          return (
            (p?.full_name?.toLowerCase().includes(q) ?? false) ||
            (p?.email.toLowerCase().includes(q) ?? false) ||
            (d.shift_label?.toLowerCase().includes(q) ?? false)
          );
        },
      }}
      empty={{
        title: "No shifts scheduled",
        description: "Schedule the first shift to start tracking duty.",
      }}
    />
  );
}
