"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { EndOfDayFormDialog } from "./end-of-day-form-dialog";
import { deleteEndOfDayReport } from "@/lib/actions/site-monitoring";
import type { Database } from "@/types/database";

type Row = Database["palaro"]["Tables"]["end_of_day_reports"]["Row"];
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name" | "site_type">;

interface Props {
  reports: Row[];
  sites: Site[];
  canEdit: boolean;
}

export function EndOfDayTable({ reports, sites, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? reports.filter(
        (r) =>
          (siteName.get(r.site_id) ?? "").toLowerCase().includes(q) ||
          r.report_date.includes(q) ||
          r.reporting_officer_name.toLowerCase().includes(q),
      )
    : reports;

  async function handleDelete(id: string) {
    if (!confirm("Delete this end-of-day report?")) return;
    const res = await deleteEndOfDayReport({ id });
    if (res.error) {
      toast.error("Delete failed", { description: res.error });
      return;
    }
    toast.success("Deleted");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search BQ, date, officer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>BQ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Athletes out</TableHead>
              <TableHead>Personnel out</TableHead>
              <TableHead>Officials out</TableHead>
              <TableHead>Reporting officer</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 8 : 7}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No end-of-day reports yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-medium">
                    {r.report_date}
                  </TableCell>
                  <TableCell className="text-sm">
                    {siteName.get(r.site_id) ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.all_accounted_for ? (
                      <Badge variant="default">All accounted for</Badge>
                    ) : (
                      <Badge variant="destructive">Some outside</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.outside_athletes}</TableCell>
                  <TableCell className="text-xs">{r.outside_personnel}</TableCell>
                  <TableCell className="text-xs">{r.outside_officials}</TableCell>
                  <TableCell className="text-xs">
                    {r.reporting_officer_name}
                    {r.reporting_officer_position ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {r.reporting_officer_position}
                      </span>
                    ) : null}
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <EodRowActions
                        report={r}
                        sites={sites}
                        onDelete={() => handleDelete(r.id)}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface EodRowActionsProps {
  report: Row;
  sites: Site[];
  onDelete: () => void;
}

function EodRowActions({ report, sites, onDelete }: EodRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EndOfDayFormDialog
        sites={sites}
        report={report}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
