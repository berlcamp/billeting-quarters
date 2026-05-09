"use client";

import { useMemo } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { VipFormDialog } from "./vip-form-dialog";
import { AssignProtocolOfficerDialog } from "./assign-protocol-officer-dialog";
import type { Database } from "@/types/database";

type Vip = Database["palaro"]["Tables"]["vip_persons"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string;
};

interface Props {
  vips: Vip[];
  delegations: Delegation[];
  // All currently-assigned protocol officer profiles, used to render the
  // assignment column without an extra request.
  protocolOfficers: ProfileLite[];
  // Command Center / Super Admin: can re-assign Protocol Officers via the
  // dedicated dialog.
  canAssign: boolean;
  // Command Center / Super Admin: can edit the VIP record itself.
  canEdit: boolean;
}

export function VipsTable({
  vips,
  delegations,
  protocolOfficers,
  canAssign,
  canEdit,
}: Props) {
  const delegationMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);
  const officerMap = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const p of protocolOfficers) m.set(p.id, p);
    return m;
  }, [protocolOfficers]);

  // The "Protocol Officer" column reflects the assignment field. Older rows
  // that pre-date assignment fall back to the creator.
  function ownerIdOf(v: Vip): string | null {
    return v.protocol_officer_id ?? v.created_by ?? null;
  }

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
      id: "officer",
      header: "Protocol Officer",
      cell: (v) => {
        const oid = ownerIdOf(v);
        const officer = oid ? officerMap.get(oid) : null;
        return officer ? (
          <span className="text-sm">
            {officer.full_name ?? officer.email}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-24",
      cell: (v) => (
        <div className="flex items-center justify-end gap-1">
          {canAssign ? (
            <AssignProtocolOfficerDialog
              vip={{
                id: v.id,
                full_name: v.full_name,
                protocol_officer_id: v.protocol_officer_id,
              }}
              trigger={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Assign protocol officer"
                >
                  <UserPlus className="size-3.5" />
                </Button>
              }
            />
          ) : null}
          {canEdit ? (
            <VipFormDialog
              delegations={delegations}
              protocolOfficers={protocolOfficers}
              vip={v}
              trigger={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Edit VIP"
                >
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
          ) : null}
        </div>
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
