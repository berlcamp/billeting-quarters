"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MovementDialog } from "./movement-dialog";
import { SupplyFormDialog } from "./supply-form-dialog";
import { deleteSupply } from "@/lib/actions/supplies";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Supply = Database["palaro"]["Tables"]["medical_supplies"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;

interface Props {
  supplies: Supply[];
  sites: Site[];
}

function isExpiringSoon(date: string | null): boolean {
  if (!date) return false;
  const expiry = Date.parse(date);
  if (Number.isNaN(expiry)) return false;
  const days = (expiry - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 30;
}

function isExpired(date: string | null): boolean {
  if (!date) return false;
  const expiry = Date.parse(date);
  return !Number.isNaN(expiry) && expiry < Date.now();
}

export function SuppliesTable({ supplies, sites }: Props) {
  const router = useRouter();

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(`Discontinue ${name}? Stock movements remain on file.`)
    ) {
      return;
    }
    const result = await deleteSupply({ id });
    if (result.error) {
      toast.error("Discontinue failed", { description: result.error });
      return;
    }
    toast.success(`${name} discontinued`);
    router.refresh();
  }

  const columns: DataTableColumn<Supply>[] = [
    {
      id: "name",
      header: "Item",
      cell: (s) => (
        <div className="flex flex-col">
          <span className="font-medium">{s.name}</span>
          {s.category ? (
            <span className="text-xs text-muted-foreground">{s.category}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "stock",
      header: "Stock",
      cell: (s) => {
        const low = s.current_stock <= s.reorder_level;
        return (
          <div className="flex flex-col">
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                low && s.current_stock > 0 && "text-orange-600",
                s.current_stock === 0 && "text-red-600",
              )}
            >
              {s.current_stock} {s.unit}
            </span>
            <span className="text-xs text-muted-foreground">
              reorder at {s.reorder_level}
            </span>
          </div>
        );
      },
    },
    {
      id: "expiry",
      header: "Expiry",
      cell: (s) => {
        if (!s.expiry_date) {
          return <span className="text-muted-foreground">—</span>;
        }
        const expired = isExpired(s.expiry_date);
        const soon = isExpiringSoon(s.expiry_date);
        return (
          <span
            className={cn(
              "font-mono text-xs",
              expired && "text-red-600 font-semibold",
              !expired && soon && "text-orange-600 font-semibold",
            )}
          >
            {s.expiry_date}
            {expired ? " (expired)" : soon ? " (soon)" : ""}
          </span>
        );
      },
    },
    {
      id: "site",
      header: "Storage",
      cell: (s) =>
        s.storage_site_id ? (
          (siteMap.get(s.storage_site_id) ?? "—")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "flags",
      header: "Flags",
      cell: (s) => {
        const flags: { label: string; cls: string }[] = [];
        if (s.current_stock === 0) {
          flags.push({
            label: "Out of stock",
            cls: "bg-red-100 text-red-800",
          });
        } else if (s.current_stock <= s.reorder_level) {
          flags.push({
            label: "Low",
            cls: "bg-orange-100 text-orange-800",
          });
        }
        if (s.expiry_date && isExpired(s.expiry_date)) {
          flags.push({
            label: "Expired",
            cls: "bg-red-100 text-red-800",
          });
        } else if (s.expiry_date && isExpiringSoon(s.expiry_date)) {
          flags.push({
            label: "Expiring",
            cls: "bg-yellow-100 text-yellow-800",
          });
        }
        if (flags.length === 0) {
          return <span className="text-xs text-muted-foreground">OK</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <Badge
                key={f.label}
                variant="secondary"
                className={cn("border-transparent", f.cls)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-44 text-right",
      cell: (s) => (
        <div className="flex items-center justify-end gap-1">
          <MovementDialog
            supplies={[s]}
            defaultSupplyId={s.id}
            defaultType="stock_in"
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Stock in">
                <ArrowDownToLine className="size-3.5 text-green-700" />
              </Button>
            }
          />
          <MovementDialog
            supplies={[s]}
            defaultSupplyId={s.id}
            defaultType="stock_out"
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Stock out">
                <ArrowUpFromLine className="size-3.5 text-blue-700" />
              </Button>
            }
          />
          <SupplyFormDialog
            supply={s}
            sites={sites}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Edit supply">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Discontinue"
            onClick={() => handleDelete(s.id, s.name)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={supplies}
      columns={columns}
      rowKey={(s) => s.id}
      pageSize={20}
      searchable={{
        placeholder: "Search by name, category…",
        predicate: (s, q) =>
          s.name.toLowerCase().includes(q) ||
          (s.category?.toLowerCase().includes(q) ?? false),
      }}
      empty={{
        title: "No supplies tracked yet",
        description: "Add a supply item to start tracking stock and expiry.",
      }}
    />
  );
}
