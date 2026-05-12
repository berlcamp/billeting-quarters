"use client";

import { Plus, Trash2, Users } from "lucide-react";
import {
  useController,
  useFieldArray,
  type Control,
  type FieldArrayPath,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database";

type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NO_DELEGATION = "__none__";

interface Props<TForm extends FieldValues> {
  control: Control<TForm>;
  name: FieldArrayPath<TForm>;
  delegations: Delegation[];
  emptyHint?: string;
  showHeader?: boolean;
}

export function ManifestRowsField<TForm extends FieldValues>({
  control,
  name,
  delegations,
  emptyHint = "Add at least one passenger group.",
  showHeader = true,
}: Props<TForm>) {
  const { fields, append, remove } = useFieldArray({ control, name });

  function addRow() {
    append({
      delegation_id: null,
      team_name: "",
      total_passengers: 1,
      notes: undefined,
    } as never);
  }

  return (
    <div className="space-y-2">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Users className="size-4" />
            Passenger groups
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addRow}
          >
            <Plus className="size-3.5" />
            Add group
          </Button>
        </div>
      ) : null}

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : null}

      <div className="space-y-2">
        {fields.map((field, index) => {
          const base = `${String(name)}.${index}`;
          return (
            <div
              key={field.id}
              className="grid grid-cols-12 gap-2 rounded-md border p-2"
            >
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-xs">Delegation</Label>
                <ManifestDelegationSelect
                  control={control}
                  name={`${base}.delegation_id` as FieldPath<TForm>}
                  delegations={delegations}
                />
              </div>
              <div className="col-span-7 sm:col-span-5">
                <Label className="text-xs">Team / sport</Label>
                <ManifestTeamInput
                  control={control}
                  name={`${base}.team_name` as FieldPath<TForm>}
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Label className="text-xs">Pax</Label>
                <ManifestPaxInput
                  control={control}
                  name={`${base}.total_passengers` as FieldPath<TForm>}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label="Remove group"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {!showHeader && fields.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addRow}
        >
          <Plus className="size-3.5" />
          Add group
        </Button>
      ) : null}
    </div>
  );
}

// Inner controlled wrappers — kept tiny so the outer component reads cleanly.

function ManifestDelegationSelect<TForm extends FieldValues>({
  control,
  name,
  delegations,
}: {
  control: Control<TForm>;
  name: FieldPath<TForm>;
  delegations: Delegation[];
}) {
  const { field } = useController({ control, name });
  const current = (field.value as string | null | undefined) ?? null;
  return (
    <Select
      value={current ?? NO_DELEGATION}
      onValueChange={(v) =>
        field.onChange(v === NO_DELEGATION ? null : v)
      }
    >
      <SelectTrigger className="h-9 w-full">
        <SelectValue>
          {(v: string | null) => {
            if (!v || v === NO_DELEGATION) {
              return <span className="text-muted-foreground">No delegation</span>;
            }
            const d = delegations.find((x) => x.id === v);
            return d ? `${d.region_code} — ${d.region_name}` : v;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_DELEGATION}>No delegation</SelectItem>
        {delegations.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.region_code} — {d.region_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ManifestTeamInput<TForm extends FieldValues>({
  control,
  name,
}: {
  control: Control<TForm>;
  name: FieldPath<TForm>;
}) {
  const { field } = useController({ control, name });
  return (
    <Input
      placeholder="e.g. Badminton"
      value={(field.value as string | undefined) ?? ""}
      onChange={(e) => field.onChange(e.target.value)}
    />
  );
}

function ManifestPaxInput<TForm extends FieldValues>({
  control,
  name,
}: {
  control: Control<TForm>;
  name: FieldPath<TForm>;
}) {
  const { field } = useController({ control, name });
  return (
    <Input
      type="number"
      min={1}
      value={(field.value as number | undefined) ?? ""}
      onChange={(e) =>
        field.onChange(e.target.value === "" ? 0 : Number(e.target.value))
      }
    />
  );
}
