"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ScheduleRuleDialog } from "./schedule-rule-dialog";
import { deleteGarbageScheduleRule } from "@/lib/actions/garbage";
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_SHORT } from "@/lib/garbage-week";
import type { Database } from "@/types/database";

type Rule = Database["palaro"]["Tables"]["garbage_schedule_rules"]["Row"];
type Collector = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  rules: Rule[];
  collectors: Collector[];
  sites: Site[];
}

export function ScheduleRulesTable({ rules, collectors, sites }: Props) {
  const [editing, setEditing] = useState<Rule | null>(null);
  const [stableEditing, setStableEditing] = useState<Rule | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Rule | null>(null);
  const router = useRouter();

  const collectorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of collectors) m.set(c.id, c.driver_name ?? "—");
    return m;
  }, [collectors]);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  async function handleDelete() {
    if (!deletingTarget) return;
    const result = await deleteGarbageScheduleRule({ id: deletingTarget.id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Rule removed");
    setDeletingTarget(null);
    router.refresh();
  }

  function formatDays(days: number[] | null | undefined): string {
    const sorted = [...(days ?? [])].sort((a, b) => a - b);
    return sorted.map((d) => DAY_OF_WEEK_SHORT[d]).join(", ");
  }

  const columns: DataTableColumn<Rule>[] = [
    {
      id: "days",
      header: "Days",
      cell: (r) => (
        <span className="font-medium">{formatDays(r.days_of_week)}</span>
      ),
    },
    {
      id: "time",
      header: "Times (PHT)",
      cell: (r) => (
        <span className="font-mono text-xs">
          {r.time_of_day.slice(0, 5)}
          {r.time_of_day_pm ? ` · ${r.time_of_day_pm.slice(0, 5)}` : ""}
        </span>
      ),
    },
    {
      id: "collector",
      header: "Collector",
      cell: (r) =>
        collectorMap.get(r.collector_id) ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "site",
      header: "Site",
      cell: (r) =>
        siteMap.get(r.site_id) ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "",
      className: "w-24",
      cell: (r) =>
        r.is_active ? null : (
          <Badge
            variant="secondary"
            className="border-transparent bg-muted text-muted-foreground"
          >
            Inactive
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (r) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setDeletingTarget(r);
          }}
          aria-label="Remove rule"
        >
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={rules}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={{
          placeholder: "Search by collector, site, day…",
          predicate: (r, q) => {
            const dayMatch = (r.days_of_week ?? []).some((d) =>
              DAY_OF_WEEK_LABELS[d].toLowerCase().includes(q),
            );
            return (
              (collectorMap
                .get(r.collector_id)
                ?.toLowerCase()
                .includes(q) ??
                false) ||
              (siteMap.get(r.site_id)?.toLowerCase().includes(q) ?? false) ||
              dayMatch
            );
          },
        }}
        empty={{
          title: "No schedule rules yet",
          description:
            "Add a rule to make a collector pick up a site on a recurring day & time.",
        }}
        onRowClick={(r) => {
          setStableEditing(r);
          setEditing(r);
        }}
      />
      {stableEditing && (
        <ScheduleRuleDialog
          rule={stableEditing}
          collectors={collectors}
          sites={sites}
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
        title="Remove this schedule rule?"
        description={
          deletingTarget ? (
            <>
              The {formatDays(deletingTarget.days_of_week)}{" "}
              {deletingTarget.time_of_day.slice(0, 5)}
              {deletingTarget.time_of_day_pm
                ? ` / ${deletingTarget.time_of_day_pm.slice(0, 5)}`
                : ""}{" "}
              pickup at{" "}
              <span className="font-medium">
                {siteMap.get(deletingTarget.site_id) ?? "—"}
              </span>{" "}
              will stop generating new weeks. Already-generated pickups stay in
              history.
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
