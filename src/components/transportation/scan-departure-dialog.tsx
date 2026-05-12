"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useController,
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Send,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ManifestRowsField } from "@/components/transportation/manifest-rows-field";
import {
  lookupVehicleByScan,
  openTripFromDeparture,
  recordDeparture,
  type ActiveTrip,
} from "@/lib/actions/vehicles";
import {
  continueDepartureSchema,
  openTripFromDepartureSchema,
  type ContinueDepartureInput,
  type OpenTripFromDepartureInput,
} from "@/lib/schemas/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const SCANNER_ELEMENT_ID = "ppdms-departure-scanner";
const FREE_TEXT_SITE = "__free__";

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
      active_trip: ActiveTrip | null;
    };

export function ScanDepartureDialog({ sites, delegations }: Props) {
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
            setState({
              kind: "loaded",
              vehicle_id: data.vehicle_id,
              vehicle_code: data.vehicle_code,
              active_trip: data.active_trip,
            });
          },
          () => {
            // decode failures fire constantly during scanning — ignore
          },
        );
      } catch (err) {
        setScannerError(
          err instanceof Error
            ? err.message
            : "Camera access failed. Use manual entry instead.",
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
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Send className="size-4" />
            Scan for Departure
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Scan bus for departure</DialogTitle>
          <DialogDescription>
            Point the camera at the bus QR. If a trip is already open, the form
            switches to the continuation flow.
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
          <DepartureForm
            sites={sites}
            delegations={delegations}
            vehicleCode={state.vehicle_code}
            scannedValue={state.vehicle_code}
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

interface FormProps {
  sites: Site[];
  delegations: Delegation[];
  vehicleCode: string;
  scannedValue: string;
  activeTrip: ActiveTrip | null;
  onDone: () => void;
  onRescan: () => void;
}

function DepartureForm({
  sites,
  delegations,
  vehicleCode,
  scannedValue,
  activeTrip,
  onDone,
  onRescan,
}: FormProps) {
  // Branch on active trip state.
  if (activeTrip?.open_leg) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="size-4" />
          <div className="space-y-1">
            <p className="font-medium">{vehicleCode} is still in transit.</p>
            <p className="text-xs">
              Record arrival at this terminal first, then scan again to depart
              for the next stop.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onRescan}>
          Scan another bus
        </Button>
      </div>
    );
  }

  if (activeTrip) {
    return (
      <ContinueTripForm
        sites={sites}
        delegations={delegations}
        vehicleCode={vehicleCode}
        activeTrip={activeTrip}
        onDone={onDone}
        onRescan={onRescan}
      />
    );
  }

  return (
    <OpenTripForm
      sites={sites}
      delegations={delegations}
      vehicleCode={vehicleCode}
      scannedValue={scannedValue}
      onDone={onDone}
      onRescan={onRescan}
    />
  );
}

// -----------------------------------------------------------------------------
// Open a brand-new trip
// -----------------------------------------------------------------------------

function OpenTripForm({
  sites,
  delegations,
  vehicleCode,
  scannedValue,
  onDone,
  onRescan,
}: {
  sites: Site[];
  delegations: Delegation[];
  vehicleCode: string;
  scannedValue: string;
  onDone: () => void;
  onRescan: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fromMode, setFromMode] = useState<"site" | "free">("site");
  const [toMode, setToMode] = useState<"site" | "free">("site");

  const form = useForm<OpenTripFromDepartureInput>({
    resolver: zodResolver(openTripFromDepartureSchema),
    defaultValues: {
      scanned_value: scannedValue,
      from_site_id: null,
      from_label: undefined,
      to_site_id: null,
      to_label: undefined,
      route_id: null,
      manifest: [
        {
          delegation_id: null,
          team_name: "",
          total_passengers: 1,
          notes: undefined,
        },
      ],
      notes: undefined,
    },
  });

  async function onSubmit(values: OpenTripFromDepartureInput) {
    setSubmitting(true);
    const result = await openTripFromDeparture({
      ...values,
      from_site_id: fromMode === "site" ? values.from_site_id || null : null,
      from_label: fromMode === "free" ? values.from_label?.trim() : undefined,
      to_site_id: toMode === "site" ? values.to_site_id || null : null,
      to_label: toMode === "free" ? values.to_label?.trim() : undefined,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error("Departure failed", { description: result.error });
      return;
    }
    toast.success(`${vehicleCode} departed`);
    router.refresh();
    onDone();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
          <Truck className="size-4" />
          <span className="font-medium">{vehicleCode}</span>
          <span className="text-muted-foreground">· new trip</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TerminalPicker
            label="From"
            sites={sites}
            mode={fromMode}
            onModeChange={setFromMode}
            siteName="from_site_id"
            labelName="from_label"
            control={form.control}
          />
          <TerminalPicker
            label="To"
            sites={sites}
            mode={toMode}
            onModeChange={setToMode}
            siteName="to_site_id"
            labelName="to_label"
            control={form.control}
          />
        </div>

        <ManifestRowsField
          control={form.control}
          name="manifest"
          delegations={delegations}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onRescan}
            disabled={submitting}
          >
            Rescan
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : (
              <CheckCircle2 className="size-4" />
            )}
            Depart
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// -----------------------------------------------------------------------------
// Continue an existing trip (no open leg → adding the next leg)
// -----------------------------------------------------------------------------

function ContinueTripForm({
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
  const [submitting, setSubmitting] = useState(false);
  const [toMode, setToMode] = useState<"site" | "free">("site");
  const [showAdd, setShowAdd] = useState(false);

  const form = useForm<ContinueDepartureInput>({
    resolver: zodResolver(continueDepartureSchema),
    defaultValues: {
      dispatch_id: activeTrip.dispatch.id,
      to_site_id: null,
      to_label: undefined,
      add_manifest: [],
      adjust_manifest: [],
      notes: undefined,
    },
  });

  async function onSubmit(values: ContinueDepartureInput) {
    setSubmitting(true);
    const result = await recordDeparture({
      ...values,
      to_site_id: toMode === "site" ? values.to_site_id || null : null,
      to_label: toMode === "free" ? values.to_label?.trim() : undefined,
      add_manifest:
        values.add_manifest && values.add_manifest.length > 0
          ? values.add_manifest
          : undefined,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error("Departure failed", { description: result.error });
      return;
    }
    toast.success(`${vehicleCode} departed`);
    router.refresh();
    onDone();
  }

  const lastLeg = activeTrip.legs[activeTrip.legs.length - 1];
  const fromLabel = lastLeg
    ? sites.find((s) => s.id === lastLeg.to_site_id)?.name ??
      lastLeg.to_label ??
      "—"
    : "—";

  const remainingByGroup = activeTrip.manifest.map((m) => ({
    ...m,
    remaining: m.total_passengers - m.dropped_off,
  }));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="size-4" />
            <span className="font-medium">{vehicleCode}</span>
            <span className="text-muted-foreground">
              · continuing trip · last terminal: {fromLabel}
            </span>
          </div>
          {remainingByGroup.length > 0 ? (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {remainingByGroup.map((m) => {
                const delegation = delegations.find(
                  (d) => d.id === m.delegation_id,
                );
                return (
                  <li key={m.id}>
                    {delegation?.region_code ? `${delegation.region_code} ` : ""}
                    {m.team_name}: {m.remaining}/{m.total_passengers} on board
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        <TerminalPicker
          label="Next terminal (To)"
          sites={sites}
          mode={toMode}
          onModeChange={setToMode}
          siteName="to_site_id"
          labelName="to_label"
          control={form.control}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Board additional groups</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? "Hide" : "Add groups"}
            </Button>
          </div>
          {showAdd ? (
            <ManifestRowsField
              control={form.control}
              name="add_manifest"
              delegations={delegations}
              showHeader={false}
              emptyHint="No new groups this leg."
            />
          ) : null}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onRescan}
            disabled={submitting}
          >
            Rescan
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : (
              <CheckCircle2 className="size-4" />
            )}
            Depart
          </Button>
        </DialogFooter>

        <p className="text-xs text-muted-foreground">
          Trip opened {formatManila(activeTrip.dispatch.dispatched_at)}.
        </p>
      </form>
    </Form>
  );
}

// -----------------------------------------------------------------------------
// Shared terminal picker (site dropdown OR free-text label)
// -----------------------------------------------------------------------------

function TerminalPicker<TForm extends FieldValues>({
  label,
  sites,
  mode,
  onModeChange,
  siteName,
  labelName,
  control,
}: {
  label: string;
  sites: Site[];
  mode: "site" | "free";
  onModeChange: (mode: "site" | "free") => void;
  siteName: FieldPath<TForm>;
  labelName: FieldPath<TForm>;
  control: Control<TForm>;
}) {
  const siteCtrl = useController({ control, name: siteName });
  const labelCtrl = useController({ control, name: labelName });

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {mode === "site" ? (
        <Select
          value={(siteCtrl.field.value as string | null) ?? ""}
          onValueChange={(v) => {
            if (v === FREE_TEXT_SITE) {
              onModeChange("free");
              siteCtrl.field.onChange(null);
            } else {
              siteCtrl.field.onChange(v);
            }
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue>
              {(v: string | null) => {
                if (!v) return (
                  <span className="text-muted-foreground">Pick a terminal</span>
                );
                const s = sites.find((x) => x.id === v);
                return s ? s.name : v;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            <SelectItem value={FREE_TEXT_SITE}>Other (type below)</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Terminal label"
            value={(labelCtrl.field.value as string | undefined) ?? ""}
            onChange={(e) => labelCtrl.field.onChange(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onModeChange("site");
              labelCtrl.field.onChange(undefined);
            }}
          >
            Use list
          </Button>
        </div>
      )}
    </div>
  );
}
