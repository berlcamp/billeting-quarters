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
import { scanAttendance } from "@/lib/actions/personnel";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const NO_SITE = "__none__";
const SCANNER_ELEMENT_ID = "ppdms-attendance-scanner";

interface Props {
  sites: Site[];
}

interface LastScan {
  ok: boolean;
  message: string;
  type?: string;
  fullName?: string | null;
}

export function ScanAttendanceDialog({ sites }: Props) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Use refs so the async scanner callback can read fresh values without
  // re-binding to a new camera each render. Synced in effects below
  // (assigning to .current during render is disallowed by React 19's
  // strict refs rule).
  const siteIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  // Cooldown to prevent the same scan triggering 5 inserts in 200ms.
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
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
          },
          async (decodedText: string) => {
            // Debounce: ignore identical scans within 2.5s.
            const now = Date.now();
            if (
              decodedText === lastScannedValueRef.current &&
              now - lastScannedAtRef.current < 2500
            ) {
              return;
            }
            if (busyRef.current) return;
            lastScannedAtRef.current = now;
            lastScannedValueRef.current = decodedText;

            setBusy(true);
            const result = await scanAttendance({
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
              message: `${ATTENDANCE_TYPE_LABELS[data.type as "time_in" | "time_out"]} — ${
                data.full_name ?? "personnel"
              }`,
              type: data.type,
              fullName: data.full_name,
            });
            router.refresh();
          },
          () => {
            // Decode failures fire constantly during normal scanning — ignore.
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
        // best-effort cleanup; html5-qrcode doesn't reject if already stopped
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
        Scan QR
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan ID QR code</DialogTitle>
          <DialogDescription>
            Point the camera at a Palaro Command personnel QR code. Time-in/out is
            chosen automatically based on the most recent scan today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="scan-site">Site (optional)</Label>
            <Select
              value={siteId ?? NO_SITE}
              onValueChange={(v) => setSiteId(v === NO_SITE ? null : v)}
            >
              <SelectTrigger id="scan-site" className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === NO_SITE) return "None";
                    const s = sites.find((x) => x.id === v);
                    return s ? s.name : "None";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SITE}>None</SelectItem>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-md border bg-black aspect-square">
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
