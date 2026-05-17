"use client";

import { useMemo } from "react";

// Number of paddles around the wheel. More paddles = denser, smoother visual
// but more DOM nodes. 14 is a sweet spot for a visible "wheel" feel.
const PADDLE_COUNT = 14;
const RADIUS = 240;

interface Props {
  angle: number;
  names: string[]; // pool of names; we sample by index = (paddleIdx + offset) % pool
  winnerName: string | null; // when set, paddle 0 displays this exact name
  spinning: boolean;
}

export function WaterwheelSpinner({
  angle,
  names,
  winnerName,
  spinning,
}: Props) {
  // While spinning, cycle through the pool: every full rotation shifts the
  // visible names so the user sees a stream rather than the same 14 names.
  const offset = Math.floor(angle / (360 / PADDLE_COUNT));

  const paddles = useMemo(() => {
    return Array.from({ length: PADDLE_COUNT }, (_, i) => {
      const slotAngle = (i * 360) / PADDLE_COUNT;
      let name: string;
      if (i === 0 && winnerName) {
        name = winnerName;
      } else if (names.length === 0) {
        name = "—";
      } else {
        name = names[(i + offset) % names.length] ?? "—";
      }
      return { i, slotAngle, name };
    });
  }, [names, offset, winnerName]);

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
          const isWinner = p.i === 0 && winnerName !== null;
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
                  "flex h-20 w-[520px] items-center justify-center rounded-xl border px-6 text-center text-2xl font-medium tracking-tight transition-colors",
                  isWinner
                    ? "border-amber-300/80 bg-gradient-to-r from-amber-400 to-amber-500 text-[#0a1740] shadow-[0_0_40px_rgba(245,197,38,0.55)]"
                    : "border-white/10 bg-white/[0.06] text-white/90 backdrop-blur-sm",
                ].join(" ")}
                style={{
                  fontFamily: "var(--font-fraunces), serif",
                }}
              >
                <span className="line-clamp-1">{p.name}</span>
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
