"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierDelegationsDialog } from "./supplier-delegations-dialog";
import { deleteSupplier } from "@/lib/actions/food";
import type { Database } from "@/types/database";

type Supplier = Database["palaro"]["Tables"]["food_suppliers"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Assignment =
  Database["palaro"]["Tables"]["food_supplier_delegations"]["Row"];

interface Props {
  suppliers: Supplier[];
  canManage: boolean;
  delegations: Delegation[];
  assignments: Assignment[];
}

export function SuppliersTable({
  suppliers,
  canManage,
  delegations,
  assignments,
}: Props) {
  const router = useRouter();

  // Map supplier_id → comma-joined delegation region_codes for the table cell.
  const assignmentLabel = useMemo(() => {
    const delegationCode = new Map(
      delegations.map((d) => [d.id, d.region_code]),
    );
    const grouped = new Map<string, string[]>();
    for (const a of assignments) {
      const code = delegationCode.get(a.delegation_id);
      if (!code) continue;
      const list = grouped.get(a.supplier_id) ?? [];
      list.push(code);
      grouped.set(a.supplier_id, list);
    }
    return grouped;
  }, [delegations, assignments]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Decommission ${name}? Existing requests are kept.`)) {
      return;
    }
    const result = await deleteSupplier({ id });
    if (result.error) {
      toast.error("Decommission failed", { description: result.error });
      return;
    }
    toast.success(`${name} decommissioned`);
    router.refresh();
  }

  const columns: DataTableColumn<Supplier>[] = [
    {
      id: "name",
      header: "Supplier",
      cell: (s) => (
        <div className="flex flex-col">
          <span className="font-medium">{s.name}</span>
          {s.business_category ? (
            <span className="text-xs text-muted-foreground">
              {s.business_category}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (s) => (
        <div className="flex flex-col text-sm">
          <span>{s.contact_person ?? "—"}</span>
          {s.contact_number ? (
            <span className="font-mono text-xs text-muted-foreground">
              {s.contact_number}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: (s) =>
        s.email ? (
          <span className="text-sm">{s.email}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "category",
      header: "Category",
      cell: (s) =>
        s.business_category ? (
          <span className="text-sm">{s.business_category}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "delegations",
      header: "Delegations",
      cell: (s) => {
        const codes = assignmentLabel.get(s.id) ?? [];
        return codes.length > 0 ? (
          <span className="text-xs">{codes.join(", ")}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        );
      },
    },
  ];

  if (canManage) {
    columns.push({
      id: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (s) => (
        <div className="flex items-center justify-end gap-1">
          <SupplierDelegationsDialog
            supplier={{ id: s.id, name: s.name }}
            delegations={delegations}
            assignments={assignments}
            trigger={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Assign delegations"
                title="Assign delegations"
              >
                <Flag className="size-3.5" />
              </Button>
            }
          />
          <SupplierFormDialog
            supplier={s}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Edit">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Decommission"
            onClick={() => handleDelete(s.id, s.name)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    });
  }

  return (
    <DataTable
      data={suppliers}
      columns={columns}
      rowKey={(s) => s.id}
      pageSize={20}
      searchable={{
        placeholder: "Search supplier…",
        predicate: (s, q) =>
          s.name.toLowerCase().includes(q) ||
          (s.business_category?.toLowerCase().includes(q) ?? false) ||
          (s.contact_person?.toLowerCase().includes(q) ?? false),
      }}
      empty={{
        title: "No suppliers yet",
        description: canManage
          ? "Add a supplier to start routing food requests."
          : "Suppliers will appear here once added by command center.",
      }}
    />
  );
}
