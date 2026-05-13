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
import { ExternalPersonnelFormDialog } from "./external-personnel-form-dialog";
import {
  deleteExternalPersonnel,
  setExternalPersonnelStatus,
} from "@/lib/actions/site-monitoring";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Row = Database["palaro"]["Tables"]["external_personnel_logs"]["Row"];
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  logs: Row[];
  sites: Site[];
  canEdit: boolean;
}

export function ExternalPersonnelTable({ logs, sites, canEdit }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  // "Today" = Manila local day. Approximated as UTC date that the
  // logged_at falls into when shifted +08:00.
  const dayCount = (() => {
    const now = new Date();
    const phNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const phToday = phNow.toISOString().slice(0, 10);
    return logs.filter((l) => {
      const phLog = new Date(new Date(l.logged_at).getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      return phLog === phToday;
    }).length;
  })();

  const q = search.trim().toLowerCase();
  const filtered = q
    ? logs.filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          l.position.toLowerCase().includes(q) ||
          (l.organization ?? "").toLowerCase().includes(q) ||
          (siteName.get(l.site_id ?? "") ?? "").toLowerCase().includes(q),
      )
    : logs;

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await deleteExternalPersonnel({ id });
    if (res.error) {
      toast.error("Delete failed", { description: res.error });
      return;
    }
    toast.success("Deleted");
    router.refresh();
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "active" ? "inactive" : "active";
    const res = await setExternalPersonnelStatus({ id, status: next });
    if (res.error) {
      toast.error("Status change failed", { description: res.error });
      return;
    }
    toast.success(`Marked ${next}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search name, position, organization…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="rounded-md border px-3 py-2 text-sm">
          <span className="text-muted-foreground">Logged today:</span>{" "}
          <span className="font-semibold">{dayCount}</span>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Org</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
              {canEdit ? <TableHead className="w-12" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canEdit ? 7 : 6}
                  className="text-center text-sm text-muted-foreground py-8"
                >
                  No personnel logged.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatManila(l.logged_at, "MMM d · HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {l.full_name}
                  </TableCell>
                  <TableCell className="text-xs">{l.position}</TableCell>
                  <TableCell className="text-xs">
                    {l.organization ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.site_id ? (siteName.get(l.site_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={l.status === "active" ? "default" : "outline"}
                    >
                      {l.status}
                    </Badge>
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <PersonnelRowActions
                        log={l}
                        sites={sites}
                        onToggleStatus={() => toggleStatus(l.id, l.status)}
                        onDelete={() => handleDelete(l.id)}
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

interface PersonnelRowActionsProps {
  log: Row;
  sites: Site[];
  onToggleStatus: () => void;
  onDelete: () => void;
}

function PersonnelRowActions({
  log,
  sites,
  onToggleStatus,
  onDelete,
}: PersonnelRowActionsProps) {
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
          <DropdownMenuItem onClick={onToggleStatus}>
            Mark {log.status === "active" ? "inactive" : "active"}
          </DropdownMenuItem>
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
      <ExternalPersonnelFormDialog
        sites={sites}
        log={log}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
