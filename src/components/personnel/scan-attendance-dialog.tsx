"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ScanLine, User } from "lucide-react";
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
import {
  getPersonnelPhotoUrl,
  scanAttendance,
} from "@/lib/actions/personnel";
import {
  ATTENDANCE_TYPE_BADGE,
  ATTENDANCE_TYPE_LABELS,
  type AttendanceType,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const SCANNER_ELEMENT_ID = "ppdms-attendance-scanner";
const RESULT_AUTO_CLOSE_MS = 4000;

interface Props {
  sites: Site[];
}

interface ScanResult {
  ok: boolean;
  message: string;
  type?: AttendanceType;
  fullName?: string | null;
  photoPath?: string | null;
  scannedAt?: number;
}

export function ScanAttendanceDialog({ sites }: Props) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultPhotoUrl, setResultPhotoUrl] = useState<string | null>(null);

  // Refs let the async scanner callback read fresh state without re-binding
  // the camera each render (assigning to .current during render is disallowed
  // by React 19's strict refs rule).
  const siteIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  // Cooldown to prevent the same QR triggering multiple inserts in 200ms.
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

            // Site is required — surface inline rather than hitting the action.
            if (!siteIdRef.current) {
              lastScannedAtRef.current = now;
              lastScannedValueRef.current = decodedText;
              setResult({
                ok: false,
                message: "Select a site before scanning.",
              });
              setResultPhotoUrl(null);
              setResultOpen(true);
              return;
            }

            lastScannedAtRef.current = now;
            lastScannedValueRef.current = decodedText;

            setBusy(true);
            const response = await scanAttendance({
              scanned_value: decodedText,
              site_id: siteIdRef.current,
            });
            setBusy(false);

            if (response.error) {
              setResult({ ok: false, message: response.error });
              setResultPhotoUrl(null);
              setResultOpen(true);
              return;
            }
            const data = response.data!;
            setResult({
              ok: true,
              message: `${ATTENDANCE_TYPE_LABELS[data.type as AttendanceType]} recorded`,
              type: data.type as AttendanceType,
              fullName: data.full_name,
              photoPath: data.photo_url,
              scannedAt: Date.now(),
            });
            setResultPhotoUrl(null);
            setResultOpen(true);
            if (data.photo_url) {
              const path = data.photo_url;
              void getPersonnelPhotoUrl(path).then((res) => {
                if (res.data) setResultPhotoUrl(res.data.url);
              });
            }
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
        scannerInstance
          .stop()
          .catch(() => undefined)
          .finally(() => scannerInstance?.clear());
      }
    };
  }, [open, router]);

  // Auto-dismiss the result popup so the operator can keep scanning.
  useEffect(() => {
    if (!resultOpen) return;
    const t = setTimeout(() => setResultOpen(false), RESULT_AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [resultOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setResultOpen(false);
      setResultPhotoUrl(null);
      setScannerError(null);
    }
  }

  const selectedSite = siteId ? sites.find((s) => s.id === siteId) ?? null : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button />}>
          <ScanLine className="size-4" />
          Scan QR
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan ID QR code</DialogTitle>
            <DialogDescription>
              Point the camera at a Palaro Command personnel QR code. Time-in/out
              is chosen automatically based on the most recent scan today.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="scan-site">
                Site <span className="text-destructive">*</span>
              </Label>
              <Select
                value={siteId ?? ""}
                onValueChange={(v) => setSiteId(v || null)}
              >
                <SelectTrigger id="scan-site" className="w-full">
                  <SelectValue>
                    {(v: string | null) => {
                      if (!v) {
                        return (
                          <span className="text-muted-foreground">
                            Select a site
                          </span>
                        );
                      }
                      const s = sites.find((x) => x.id === v);
                      return s ? (
                        s.name
                      ) : (
                        <span className="text-muted-foreground">
                          Select a site
                        </span>
                      );
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
              {!siteId ? (
                <p className="text-xs text-muted-foreground">
                  Pick the site you&apos;re posted at — required for every scan.
                </p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-md border bg-black aspect-square">
              <div id={SCANNER_ELEMENT_ID} className="size-full" />
            </div>

            {scannerError ? (
              <p className="text-xs text-destructive">{scannerError}</p>
            ) : null}

            {busy ? (
              <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Recording attendance…</span>
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

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent
          className="sm:max-w-sm"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.ok ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                  <span>
                    {result.type
                      ? `${ATTENDANCE_TYPE_LABELS[result.type]} successful`
                      : "Attendance recorded"}
                  </span>
                </>
              ) : (
                <span className="text-destructive">Scan failed</span>
              )}
            </DialogTitle>
            {result?.ok && selectedSite ? (
              <DialogDescription>at {selectedSite.name}</DialogDescription>
            ) : null}
          </DialogHeader>

          {result?.ok ? (
            <div className="flex items-center gap-4">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-md border bg-muted/30">
                {resultPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resultPhotoUrl}
                    alt={result.fullName ?? "Personnel photo"}
                    className="h-full w-full object-cover"
                  />
                ) : result.photoPath ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <User className="size-10" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="font-heading text-base font-medium leading-tight">
                  {result.fullName ?? "Personnel"}
                </p>
                {result.type ? (
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      ATTENDANCE_TYPE_BADGE[result.type],
                    )}
                  >
                    {ATTENDANCE_TYPE_LABELS[result.type]}
                  </span>
                ) : null}
                {result.scannedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {formatManila(new Date(result.scannedAt), "HH:mm:ss")}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">{result?.message}</p>
          )}

          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
