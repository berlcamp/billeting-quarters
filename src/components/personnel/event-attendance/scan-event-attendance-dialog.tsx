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
import { scanEventAttendance } from "@/lib/actions/event-attendance";
import { getPersonnelPhotoUrl } from "@/lib/actions/personnel";
import { formatManila } from "@/lib/timezone";

const SCANNER_ELEMENT_ID = "ppdms-event-attendance-scanner";
const RESULT_AUTO_CLOSE_MS = 4000;

interface Props {
  eventId: string;
}

interface ScanResult {
  ok: boolean;
  message: string;
  fullName?: string | null;
  photoPath?: string | null;
  scannedAt?: number;
}

export function ScanEventAttendanceDialog({ eventId }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultPhotoUrl, setResultPhotoUrl] = useState<string | null>(null);

  // Refs let the async scanner callback read fresh state without re-binding
  // the camera each render.
  const busyRef = useRef(false);
  // Debounce so the camera firing repeatedly doesn't insert the same scan many
  // times — duplicates across separate scans are allowed by design.
  const lastScannedAtRef = useRef(0);
  const lastScannedValueRef = useRef<string | null>(null);

  const router = useRouter();

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
            const response = await scanEventAttendance({
              event_id: eventId,
              scanned_value: decodedText,
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
              message: "Time-in recorded",
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
  }, [open, eventId, router]);

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
              Point the camera at a personnel QR code to record their time-in for
              this event.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border bg-black aspect-square">
              <div id={SCANNER_ELEMENT_ID} className="size-full" />
            </div>

            {scannerError ? (
              <p className="text-xs text-destructive">{scannerError}</p>
            ) : null}

            {busy ? (
              <div className="flex items-center gap-2 rounded-md border p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Recording time-in…</span>
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
        <DialogContent className="sm:max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.ok ? (
                <>
                  <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                  <span>Time-in recorded</span>
                </>
              ) : (
                <span className="text-destructive">Scan failed</span>
              )}
            </DialogTitle>
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
