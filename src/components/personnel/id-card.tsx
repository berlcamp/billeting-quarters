"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];

interface Props {
  personnel: Personnel;
  side: "front" | "back";
}

// PPDMS ID QR envelope. Versioned so we can change the format later
// without breaking older printed cards (the scanner accepts raw UUIDs too).
function buildQrPayload(personnelId: string): string {
  return JSON.stringify({ v: 1, id: personnelId });
}

const TEMPLATE_SRC = "/id-assets/id-template.png";

// Layout coordinates (% of the card box) for the elements we overlay on top
// of the template image. Tweak here if the template artwork shifts.
const COORDS = {
  // White photo / QR box in the upper-middle area.
  qrBox: { top: "35%", left: "32%", width: "36%", height: "24%" },
  // Name strip — large bold caps. Sits over "INSERT NAME" in the template.
  name: { top: "60.5%", left: "4%", right: "4%", height: "11%" },
  // Smaller italic role/committee strip — sits over "COMMITTEE".
  committee: { top: "69.5%", left: "12%", right: "12%", height: "6.5%" },
} as const;

// Match the navy in the template so our text-strip backgrounds masquerade as
// part of the artwork (visually erasing the "INSERT NAME"/"COMMITTEE" text
// underneath).
const TEMPLATE_NAVY = "#1e3a8a";

export function IdCard({ personnel, side }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (side !== "back") return;
    let cancelled = false;
    QRCode.toDataURL(buildQrPayload(personnel.id), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [personnel.id, side]);

  // Subtitle under the name. Designation overrides committee when present;
  // committee is required on the personnel record so the strip never empties.
  const subtitle = personnel.designation ?? personnel.committee;

  return (
    <div className="break-inside-avoid">
      <div
        className="@container relative overflow-hidden bg-white shadow-sm print:shadow-none"
        style={{
          aspectRatio: "1305 / 1850",
          // Browsers default to stripping background colors on print to save ink.
          // Force them through so the navy name/committee strips render.
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        {/* Template artwork — whole-card background. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- design asset, no Next/Image optimization needed */}
        <img
          src={TEMPLATE_SRC}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            // Hide the broken-img icon and surface a hint instead.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />

        {/* Hint shown when /id-assets/id-template.png isn't present yet. */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center bg-muted p-4 text-center text-[10px] text-muted-foreground">
          Drop <code>id-template.png</code> in <code>/public/id-assets/</code>
        </div>

        {/* QR — back only, positioned over the white photo box. */}
        {side === "back" ? (
          <div className="absolute" style={COORDS.qrBox}>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL
              <img
                src={qrDataUrl}
                alt={`QR for ${personnel.full_name}`}
                className="size-full object-contain p-1"
              />
            ) : null}
          </div>
        ) : null}

        {/* Name strip overlay — masks the "INSERT NAME" placeholder. */}
        <div
          className="absolute flex items-center justify-center px-2"
          style={{ ...COORDS.name, backgroundColor: TEMPLATE_NAVY }}
        >
          <span
            className="text-center font-extrabold uppercase leading-none text-white"
            style={{ fontSize: "clamp(11px, 7cqw, 38px)" }}
          >
            {personnel.full_name}
          </span>
        </div>

        {/* Committee/role strip overlay — masks "COMMITTEE". */}
        <div
          className="absolute flex items-center justify-center px-2"
          style={{ ...COORDS.committee, backgroundColor: TEMPLATE_NAVY }}
        >
          <span
            className="text-center italic leading-none text-white"
            style={{ fontSize: "clamp(8px, 4cqw, 22px)" }}
          >
            {subtitle}
          </span>
        </div>

        {/* Side label — visible on screen for the operator, hidden on print. */}
        <span className="absolute right-1 top-1 rounded bg-foreground/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-background print:hidden">
          {side}
        </span>
      </div>
    </div>
  );
}
