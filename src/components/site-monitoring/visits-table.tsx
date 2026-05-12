"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { VisitFormDialog } from "./visit-form-dialog";
import { deleteVisit } from "@/lib/actions/site-monitoring";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Visit = Database["palaro"]["Tables"]["site_monitoring_visits"]["Row"];
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  visits: Visit[];
  sites: Site[];
  canEdit: boolean;
}

function formatIndividuals(list: unknown): string {
  if (!Array.isArray(list)) return "";
  return list.filter((s): s is string => typeof s === "string").join(", ");
}

export function VisitsTable({ visits, sites, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const q = search.trim().toLowerCase();
  const filtered = q
    ? visits.filter((v) => {
        const inSite = (siteName.get(v.site_id) ?? "").toLowerCase().includes(q);
        const inTitle = v.visit_title.toLowerCase().includes(q);
        const inIndividuals = formatIndividuals(v.individuals)
          .toLowerCase()
          .includes(q);
        const inObs = (v.observations ?? "").toLowerCase().includes(q);
        return inSite || inTitle || inIndividuals || inObs;
      })
    : visits;

  async function handleDelete(id: string) {
    if (!confirm("Delete this visit log?")) return;
    const res = await deleteVisit({ id });
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
        placeholder="Search visits, sites, individuals…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When (PHT)</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Individuals</TableHead>
              <TableHead>Observations</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 6 : 5}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No visit logs yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatManila(v.visited_at, "MMM d · HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {siteName.get(v.site_id) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {v.visit_title}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {formatIndividuals(v.individuals) || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    {v.observations || "—"}
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <VisitFormDialog
                            sites={sites}
                            visit={v}
                            trigger={
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem
                            onClick={() => handleDelete(v.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
