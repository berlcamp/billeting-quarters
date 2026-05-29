"use client";

import { useEffect, useMemo, useState } from "react";

// Number of paddles around the wheel. More paddles = denser, smoother visual
// but more DOM nodes. 14 is a sweet spot for a visible "wheel" feel.
const PADDLE_COUNT = 14;
const RADIUS = 240;
// How long the designation teases on the landed paddle before the winner's
// name is revealed. Also re-used by the draw board to defer the sidebar
// reveal so the wheel name lands first.
export const DESIGNATION_TEASE_MS = 3000;

export type SpinnerEntry = { name: string; designation: string | null };

interface Props {
  angle: number;
  entries: SpinnerEntry[]; // pool; we sample by index = (paddleIdx + offset) % pool
  // when set, paddle 0 displays this exact entry (used so the landed paddle
  // matches the server-chosen winner regardless of pool ordering).
  winner: SpinnerEntry | null;
  spinning: boolean;
  // When true (default), hide names during the spin and tease the designation
  // on the landed paddle for DESIGNATION_TEASE_MS before showing the name.
  suspense?: boolean;
}

export function WaterwheelSpinner({
  angle,
  entries,
  winner,
  spinning,
  suspense = true,
}: Props) {
  // When a winner with a designation lands, hold on the designation alone for
  // a beat before revealing the name. The phase resets whenever `winner`
  // changes (new spin clears it back to null).
  const [revealPhase, setRevealPhase] = useState<"designation" | "name">(
    "name",
  );
  const hasDesignation = !!winner?.designation?.trim();
  const teaseLandedPaddle = suspense && hasDesignation;

  useEffect(() => {
    if (!winner || !teaseLandedPaddle) {
      setRevealPhase("name");
      return;
    }
    setRevealPhase("designation");
    const t = setTimeout(() => setRevealPhase("name"), DESIGNATION_TEASE_MS);
    return () => clearTimeout(t);
  }, [winner, teaseLandedPaddle]);

  // While spinning, cycle through the pool: every full rotation shifts the
  // visible names so the user sees a stream rather than the same 14 names.
  const offset = Math.floor(angle / (360 / PADDLE_COUNT));

  const paddles = useMemo(() => {
    return Array.from({ length: PADDLE_COUNT }, (_, i) => {
      const slotAngle = (i * 360) / PADDLE_COUNT;
      let entry: SpinnerEntry;
      if (i === 0 && winner) {
        entry = winner;
      } else if (entries.length === 0) {
        entry = { name: "—", designation: null };
      } else {
        entry = entries[(i + offset) % entries.length] ?? {
          name: "—",
          designation: null,
        };
      }
      return { i, slotAngle, entry };
    });
  }, [entries, offset, winner]);

  return (
    <div className="relative isolate flex h-[560px] w-full items-center justify-center [perspective:1400px]">
      {/* radial glow behind wheel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(245,197,38,0.18), transparent 55%)",
        }}
      />

      {/* the wheel */}
      <div
        className="relative h-[480px] w-[600px] [transform-style:preserve-3d] will-change-transform"
        style={{
          transform: `rotateX(${angle}deg)`,
          transition: spinning
            ? "none"
            : "transform 600ms cubic-bezier(0.2,0.7,0.2,1)",
        }}
      >
        {paddles.map((p) => {
          const isWinner = p.i === 0 && winner !== null;
          const teasingDesignation =
            isWinner && teaseLandedPaddle && revealPhase === "designation";
          // During the spin (when `suspense` is on), every paddle hides the
          // name and shows the designation — keeps the audience guessing.
          const hidingNameWhileSpinning = suspense && spinning;
          const designationOnly = teasingDesignation || hidingNameWhileSpinning;
          return (
            <div
              key={p.i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [backface-visibility:hidden]"
              style={{
                transform: `rotateX(${p.slotAngle}deg) translateZ(${RADIUS}px)`,
              }}
            >
              <div
                className={[
                  "flex h-20 w-[520px] flex-col items-center justify-center rounded-xl border px-6 text-center transition-colors",
                  isWinner
                    ? "border-amber-300/80 bg-gradient-to-r from-amber-400 to-amber-500 text-[#0a1740] shadow-[0_0_40px_rgba(245,197,38,0.55)]"
                    : "border-white/10 bg-white/[0.06] text-white/90 backdrop-blur-sm",
                  teasingDesignation ? "animate-pulse" : "",
                ].join(" ")}
                style={{
                  fontFamily: "var(--font-fraunces), serif",
                }}
              >
                {designationOnly ? (
                  <span
                    key={teasingDesignation ? "tease" : "spin"}
                    className={[
                      "line-clamp-1 text-2xl font-semibold uppercase tracking-[0.18em]",
                      isWinner ? "text-[#0a1740]" : "text-white/85",
                      teasingDesignation
                        ? "animate-in fade-in zoom-in-90 duration-500"
                        : "",
                    ].join(" ")}
                  >
                    {p.entry.designation?.trim() || "???"}
                  </span>
                ) : (
                  <>
                    <span
                      key={isWinner ? "winner-name" : "name"}
                      className={[
                        "line-clamp-1 text-2xl font-medium tracking-tight",
                        isWinner
                          ? "animate-in fade-in zoom-in-50 duration-500"
                          : "",
                      ].join(" ")}
                    >
                      {p.entry.name}
                    </span>
                    {p.entry.designation ? (
                      <span
                        className={[
                          "line-clamp-1 text-xs tracking-wide",
                          isWinner ? "text-[#0a1740]/75" : "text-white/55",
                        ].join(" ")}
                      >
                        {p.entry.designation}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* gold selector bar (the equator the wheel rotates through) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-1/2 z-10 h-24 -translate-y-1/2"
      >
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-amber-400/90 shadow-[0_0_24px_rgba(245,197,38,0.9)]" />
        <div className="absolute -left-2 top-1/2 size-3 -translate-y-1/2 rotate-45 bg-amber-400 shadow-[0_0_16px_rgba(245,197,38,0.9)]" />
        <div className="absolute -right-2 top-1/2 size-3 -translate-y-1/2 rotate-45 bg-amber-400 shadow-[0_0_16px_rgba(245,197,38,0.9)]" />
      </div>

      {/* top/bottom fade so the wheel feels framed */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-[#0a1740] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-[#0a1740] to-transparent"
      />
    </div>
  );
}
