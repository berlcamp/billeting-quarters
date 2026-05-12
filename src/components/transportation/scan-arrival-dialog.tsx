"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  closeTrip,
  lookupVehicleByScan,
  recordArrival,
  type ActiveTrip,
} from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const SCANNER_ELEMENT_ID = "ppdms-arrival-scanner";

interface Props {
  sites: Site[];
  delegations: Delegation[];
}

type LookupState =
  | { kind: "scanning" }
  | { kind: "error"; message: string }
  | {
      kind: "loaded";
      vehicle_id: string;
      vehicle_code: string;
      active_trip: ActiveTrip;
    };

export function ScanArrivalDialog({ sites, delegations }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LookupState>({ kind: "scanning" });
  const [scannerError, setScannerError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const lastScannedRef = useRef<{ value: string; at: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (state.kind !== "scanning") return;
    let stopped = false;
    let scannerInstance: { stop: () => Promise<void>; clear: () => void } | null =
      null;

    async function start() {
      try {
        const mod = await import("html5-qrcode");
        if (stopped) return;
        const scanner = new mod.Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerInstance = scanner as typeof scannerInstance;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            const now = Date.now();
            const last = lastScannedRef.current;
            if (last && last.value === decodedText && now - last.at < 2500) {
              return;
            }
            if (busyRef.current) return;
            lastScannedRef.current = { value: decodedText, at: now };
            busyRef.current = true;
            const result = await lookupVehicleByScan({
              scanned_value: decodedText,
            });
            busyRef.current = false;
            if (result.error) {
              setState({ kind: "error", message: result.error });
              return;
            }
            const data = result.data!;
            if (!data.is_active) {
              setState({
                kind: "error",
                message: "Vehicle is decommissioned.",
              });
              return;
            }
            if (!data.active_trip) {
              setState({
                kind: "error",
                message:
                  "No open trip for this bus. Use Scan for Departure to open one.",
              });
              return;
            }
            if (!data.active_trip.open_leg) {
              setState({
                kind: "error",
                message:
                  "The bus arrived already — scan again for the next departure.",
              });
              return;
            }
            setState({
              kind: "loaded",
              vehicle_id: data.vehicle_id,
              vehicle_code: data.vehicle_code,
              active_trip: data.active_trip,
            });
          },
          () => {
            // ignore decode failures
          },
        );
      } catch (err) {
        setScannerError(
          err instanceof Error
            ? err.message
            : "Camera access failed.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      if (scannerInstance) {
        scannerInstance
          .stop()
          .catch(() => undefined)
          .finally(() => scannerInstance?.clear());
      }
    };
  }, [open, state.kind]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setState({ kind: "scanning" });
      setScannerError(null);
      lastScannedRef.current = null;
    }
  }

  function resetToScanner() {
    setState({ kind: "scanning" });
    lastScannedRef.current = null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button className="bg-sky-600 hover:bg-sky-700 text-white">
            <MapPin className="size-4" />
            Scan for Arrival
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Scan bus on arrival</DialogTitle>
          <DialogDescription>
            Records the arrival time and per-group drop-offs at this terminal.
          </DialogDescription>
        </DialogHeader>

        {state.kind === "scanning" ? (
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-md border bg-black">
              <div id={SCANNER_ELEMENT_ID} className="size-full" />
            </div>
            {scannerError ? (
              <p className="text-xs text-destructive">{scannerError}</p>
            ) : null}
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4" />
              <span>{state.message}</span>
            </div>
            <Button variant="outline" onClick={resetToScanner}>
              Try another scan
            </Button>
          </div>
        ) : null}

        {state.kind === "loaded" ? (
          <ArrivalForm
            sites={sites}
            delegations={delegations}
            vehicleCode={state.vehicle_code}
            activeTrip={state.active_trip}
            onDone={() => handleOpenChange(false)}
            onRescan={resetToScanner}
          />
        ) : null}

        {state.kind === "scanning" ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ArrivalForm({
  sites,
  delegations,
  vehicleCode,
  activeTrip,
  onDone,
  onRescan,
}: {
  sites: Site[];
  delegations: Delegation[];
  vehicleCode: string;
  activeTrip: ActiveTrip;
  onDone: () => void;
  onRescan: () => void;
}) {
  const router = useRouter();
  const leg = activeTrip.open_leg!;
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [arrivalNotes, setArrivalNotes] = useState("");
  const [dropoffs, setDropoffs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      activeTrip.manifest.map((m) => [
        m.id,
        // Default each row to its remaining count — fast path "all got off".
        String(m.total_passengers - m.dropped_off),
      ]),
    ),
  );
  const [arrived, setArrived] = useState(false);

  const fromName = leg.from_site_id
    ? sites.find((s) => s.id === leg.from_site_id)?.name ?? leg.from_label
    : leg.from_label;
  const toName = leg.to_site_id
    ? sites.find((s) => s.id === leg.to_site_id)?.name ?? leg.to_label
    : leg.to_label;

  async function onArrive() {
    setSubmitting(true);
    const payload = {
      dispatch_id: activeTrip.dispatch.id,
      leg_id: leg.id,
      arrival_notes: arrivalNotes.trim() || undefined,
      dropoffs: activeTrip.manifest.map((m) => {
        const raw = dropoffs[m.id] ?? "0";
        const n = Number.parseInt(raw, 10);
        return {
          manifest_id: m.id,
          count: Number.isFinite(n) && n > 0 ? n : 0,
        };
      }),
    };
    const result = await recordArrival(payload);
    setSubmitting(false);
    if (result.error) {
      toast.error("Arrival failed", { description: result.error });
      return;
    }
    toast.success(`${vehicleCode} arrived`);
    setArrived(true);
    router.refresh();
  }

  async function onClose() {
    setClosing(true);
    const result = await closeTrip({
      dispatch_id: activeTrip.dispatch.id,
    });
    setClosing(false);
    if (result.error) {
      toast.error("Close failed", { description: result.error });
      return;
    }
    toast.success("Trip closed");
    router.refresh();
    onDone();
  }

  const allEmpty = activeTrip.manifest.every((m) => {
    const raw = dropoffs[m.id] ?? "0";
    const n = Number.parseInt(raw, 10);
    const dropped = Number.isFinite(n) && n > 0 ? n : 0;
    return m.total_passengers - m.dropped_off - dropped <= 0;
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
        <div className="flex items-center gap-2">
          <Truck className="size-4" />
          <span className="font-medium">{vehicleCode}</span>
          <span className="text-muted-foreground">
            · leg {leg.leg_order}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {fromName ?? "—"} → {toName ?? "—"} · departed{" "}
          {formatManila(leg.departed_at)}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Drop-offs at this terminal</Label>
        <div className="space-y-2">
          {activeTrip.manifest.map((m) => {
            const remaining = m.total_passengers - m.dropped_off;
            const delegation = delegations.find(
              (d) => d.id === m.delegation_id,
            );
            return (
              <div
                key={m.id}
                className="grid grid-cols-12 items-center gap-2 rounded-md border p-2"
              >
                <div className="col-span-8 text-sm">
                  <p className="font-medium">{m.team_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {delegation
                      ? `${delegation.region_code} — ${delegation.region_name}`
                      : "No delegation"}{" "}
                    · {remaining}/{m.total_passengers} on board
                  </p>
                </div>
                <div className="col-span-4">
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    disabled={remaining === 0 || arrived}
                    value={dropoffs[m.id] ?? "0"}
                    onChange={(e) =>
                      setDropoffs((prev) => ({
                        ...prev,
                        [m.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <Label htmlFor="arrival-notes" className="text-sm">
          Notes
        </Label>
        <Textarea
          id="arrival-notes"
          rows={2}
          value={arrivalNotes}
          onChange={(e) => setArrivalNotes(e.target.value)}
          disabled={arrived}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onRescan}
          disabled={submitting || closing}
        >
          Rescan
        </Button>
        {arrived ? (
          allEmpty ? (
            <Button onClick={onClose} disabled={closing}>
              {closing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Close trip
            </Button>
          ) : (
            <Button onClick={onDone}>Done</Button>
          )
        ) : (
          <Button onClick={onArrive} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Record arrival
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
