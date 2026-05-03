"use client";

import { useMemo } from "react";
import { Pencil } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { VipFormDialog } from "./vip-form-dialog";
import type { Database } from "@/types/database";

type Vip = Database["palaro"]["Tables"]["vip_persons"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

interface Props {
  vips: Vip[];
  delegations: Delegation[];
}

export function VipsTable({ vips, delegations }: Props) {
  const delegationMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);

  const columns: DataTableColumn<Vip>[] = [
    {
      id: "name",
      header: "Name",
      cell: (v) => (
        <div className="flex flex-col">
          <span className="font-medium">{v.full_name}</span>
          {v.title || v.organization ? (
            <span className="text-xs text-muted-foreground">
              {[v.title, v.organization].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "delegation",
      header: "Delegation",
      cell: (v) =>
        v.delegation_id ? (
          delegationMap.get(v.delegation_id) ?? "—"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (v) =>
        v.contact_number ? (
          <span className="font-mono text-xs">{v.contact_number}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12",
      cell: (v) => (
        <VipFormDialog
          delegations={delegations}
          vip={v}
          trigger={
            <Button size="icon-sm" variant="ghost" aria-label="Edit VIP">
              <Pencil className="size-3.5" />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <DataTable
      data={vips}
      columns={columns}
      rowKey={(v) => v.id}
      searchable={{
        placeholder: "Search VIPs…",
        predicate: (v, q) =>
          v.full_name.toLowerCase().includes(q) ||
          (v.title?.toLowerCase().includes(q) ?? false) ||
          (v.organization?.toLowerCase().includes(q) ?? false),
      }}
      pageSize={15}
      empty={{
        title: "No VIPs yet",
        description: "Add a VIP record to start logging movements.",
      }}
    />
  );
}
