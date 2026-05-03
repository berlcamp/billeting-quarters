"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scanVehicle } from "@/lib/actions/vehicles";
import { VEHICLE_LOG_DIRECTION_LABELS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const SCANNER_ELEMENT_ID = "ppdms-vehicle-scanner";

interface Props {
  sites: Site[];
}

interface LastScan {
  ok: boolean;
  message: string;
}

export function ScanVehicleDialog({ sites }: Props) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const siteIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const lastScannedAtRef = useRef(0);
  const lastScannedValueRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    siteIdRef.current = siteId;
  }, [siteId]);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let scannerInstance: { stop: () => Promise<void>; clear: () => void } | null =
      null;

    async function start() {
      try {
        const mod = await import("html5-qrcode");
        if (stopped) return;

        const ScannerCtor = mod.Html5Qrcode;
        const scanner = new ScannerCtor(SCANNER_ELEMENT_ID);
        scannerInstance = scanner as typeof scannerInstance;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText: string) => {
            const now = Date.now();
            if (
              decodedText === lastScannedValueRef.current &&
              now - lastScannedAtRef.current < 2500
            ) {
              return;
            }
            if (busyRef.current) return;
            if (!siteIdRef.current) {
              setLastScan({
                ok: false,
                message: "Pick the site you're scanning at first.",
              });
              return;
            }
            lastScannedAtRef.current = now;
            lastScannedValueRef.current = decodedText;

            setBusy(true);
            const result = await scanVehicle({
              scanned_value: decodedText,
              site_id: siteIdRef.current,
            });
            setBusy(false);

            if (result.error) {
              setLastScan({ ok: false, message: result.error });
              return;
            }
            const data = result.data!;
            setLastScan({
              ok: true,
              message: `${data.vehicle_code} — ${VEHICLE_LOG_DIRECTION_LABELS[data.direction]}`,
            });
            router.refresh();
          },
          () => {
            // Decode failures fire constantly during scanning — ignore.
          },
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Camera access failed. Use manual entry instead.";
        setScannerError(message);
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
  }, [open, router]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setLastScan(null);
      setScannerError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <ScanLine className="size-4" />
        Scan vehicle
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan vehicle QR</DialogTitle>
          <DialogDescription>
            Pick the site, then scan the dashboard QR. Direction (in/out) is
            chosen from the most recent log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-scan-site">Site</Label>
            <Select
              value={siteId ?? ""}
              onValueChange={(v) => setSiteId(v || null)}
            >
              <SelectTrigger id="vehicle-scan-site" className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v) return "Pick a site";
                    const s = sites.find((x) => x.id === v);
                    return s ? s.name : "Pick a site";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="aspect-square overflow-hidden rounded-md border bg-black">
            <div id={SCANNER_ELEMENT_ID} className="size-full" />
          </div>

          {scannerError ? (
            <p className="text-xs text-destructive">{scannerError}</p>
          ) : null}

          {lastScan ? (
            <div
              className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                lastScan.ok
                  ? "border-green-500/30 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {lastScan.ok ? <CheckCircle2 className="size-4" /> : null}
              <span>{lastScan.message}</span>
              {busy ? <Loader2 className="ml-auto size-4 animate-spin" /> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
