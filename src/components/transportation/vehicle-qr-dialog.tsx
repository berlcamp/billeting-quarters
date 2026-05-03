"use client";

import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
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
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/labels";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];

// QR envelope: scanner accepts the vehicle UUID, the vehicle_code, or this
// JSON envelope. Versioned so we can change the wire format later without
// breaking previously printed stickers.
function buildPayload(vehicle: Vehicle): string {
  return JSON.stringify({ v: 1, vid: vehicle.id, code: vehicle.vehicle_code });
}

interface Props {
  trigger: ReactNode;
  vehicle: Vehicle;
}

export function VehicleQrDialog({ trigger, vehicle }: Props) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    QRCode.toDataURL(buildPayload(vehicle), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, vehicle]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md print:max-w-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>QR sticker — {vehicle.vehicle_code}</DialogTitle>
          <DialogDescription>
            Print and affix near the dashboard. Operators scan it on entry/exit.
          </DialogDescription>
        </DialogHeader>

        <div
          className="mx-auto flex flex-col items-center gap-3 rounded-md border bg-white p-6 text-center"
          style={{
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Palaro Command — Vehicle ID
          </p>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL, no Next/Image needed
            <img
              src={dataUrl}
              alt={`QR for ${vehicle.vehicle_code}`}
              className="size-56 object-contain"
            />
          ) : (
            <div className="size-56 animate-pulse rounded bg-muted" />
          )}
          <div className="space-y-0.5">
            <p className="text-2xl font-extrabold tracking-tight">
              {vehicle.vehicle_code}
            </p>
            <p className="text-sm text-muted-foreground">
              {VEHICLE_TYPE_LABELS[vehicle.vehicle_type as VehicleType]}
              {vehicle.plate_number ? ` · ${vehicle.plate_number}` : ""}
            </p>
            {vehicle.driver_name ? (
              <p className="text-xs text-muted-foreground">
                Driver: {vehicle.driver_name}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
