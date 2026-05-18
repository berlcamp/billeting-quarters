"use client";

import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DrawSettings = {
  totalWinners: number;
  spinDurationSeconds: number;
  departmentId: "ALL" | string;
  prizeLabel: string;
  autoSpin: boolean;
  autoSpinIntervalSeconds: number;
};

interface Props {
  settings: DrawSettings;
  onChange: (next: DrawSettings) => void;
  departments: { id: string; name: string }[];
  trigger: ReactNode;
}

const DEPT_ALL = "ALL";

export function SettingsSheet({
  settings,
  onChange,
  departments,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);

  function openSheet(next: boolean) {
    if (next) setDraft(settings);
    setOpen(next);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={openSheet}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Draw settings</SheetTitle>
          <SheetDescription>
            Configure how the next draw runs. Settings apply to this browser
            session only.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          <div className="space-y-1.5">
            <Label htmlFor="total-winners">Total winners to draw</Label>
            <Input
              id="total-winners"
              type="number"
              min={1}
              max={500}
              value={draft.totalWinners}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  totalWinners: Math.max(
                    1,
                    Math.min(500, Number(e.target.value) || 1),
                  ),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              The SPIN button disables once this many winners are drawn.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spin-duration">Spin duration (seconds)</Label>
            <Input
              id="spin-duration"
              type="number"
              min={2}
              max={15}
              step={0.5}
              value={draft.spinDurationSeconds}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  spinDurationSeconds: Math.max(
                    2,
                    Math.min(15, Number(e.target.value) || 4),
                  ),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              How long the wheel spins before landing.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, departmentId: v as "ALL" | string }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === DEPT_ALL) return "All departments";
                    return (
                      departments.find((dep) => dep.id === v)?.name ?? "—"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEPT_ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick a single department to draw from, or leave on All.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prize-label">Prize label (optional)</Label>
            <Input
              id="prize-label"
              placeholder="e.g. iPad Pro"
              value={draft.prizeLabel}
              onChange={(e) =>
                setDraft((d) => ({ ...d, prizeLabel: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Saved with each winner record.
            </p>
          </div>

          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="auto-spin"
                checked={draft.autoSpin}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, autoSpin: v === true }))
                }
                className="mt-0.5"
              />
              <div className="flex flex-col">
                <Label htmlFor="auto-spin" className="cursor-pointer">
                  Auto-spin for multi-winner draws
                </Label>
                <p className="text-xs text-muted-foreground">
                  When more than 1 winner is configured, the next spin
                  triggers automatically after the interval below.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-spin-interval">
                Interval between spins (seconds)
              </Label>
              <Input
                id="auto-spin-interval"
                type="number"
                min={1}
                max={60}
                step={0.5}
                disabled={!draft.autoSpin}
                value={draft.autoSpinIntervalSeconds}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    autoSpinIntervalSeconds: Math.max(
                      1,
                      Math.min(60, Number(e.target.value) || 3),
                    ),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Pause after a winner lands before the next spin starts.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Save className="size-4" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
