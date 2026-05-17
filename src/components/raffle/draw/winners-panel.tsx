"use client";

import { Trophy, Sparkles } from "lucide-react";
import type { DrawWinnerResult } from "@/lib/actions/raffle";

interface Props {
  winners: DrawWinnerResult[];
  totalGoal: number;
  landed: boolean;
}

export function WinnersPanel({ winners, totalGoal, landed }: Props) {
  const latest = winners[winners.length - 1];
  const prior = winners.slice(0, -1).reverse();

  return (
    <aside className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white backdrop-blur-sm">
      <div className="flex items-center justify-between font-[var(--font-fraunces)]">
        <h2 className="text-xl font-medium tracking-wide">Winners</h2>
        <span className="rounded-full border border-amber-400/40 px-3 py-0.5 font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.18em] text-amber-300">
          {winners.length} / {totalGoal}
        </span>
      </div>

      {latest ? (
        <div
          className={[
            "relative overflow-hidden rounded-xl border p-5 transition-all",
            landed
              ? "border-amber-300/80 bg-gradient-to-br from-amber-400/30 to-amber-500/10 shadow-[0_0_50px_rgba(245,197,38,0.35)]"
              : "border-white/15 bg-white/[0.04]",
          ].join(" ")}
        >
          <div className="flex items-center gap-1.5 font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.2em] text-amber-300">
            <Trophy className="size-3" />
            Latest · #{latest.draw_index}
          </div>
          <p
            className="mt-2 break-words text-3xl font-medium leading-tight"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
          >
            {latest.entry_name}
          </p>
          <p className="mt-1 text-sm text-white/65">{latest.department_name}</p>

          {landed ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => {
                const angle = (i * 360) / 16;
                return (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-amber-300"
                    style={{
                      animation: `confettiBurst 1.6s ease-out ${i * 20}ms both`,
                      // @ts-expect-error CSS custom property
                      "--angle": `${angle}deg`,
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-6 text-center">
          <Sparkles className="size-6 text-amber-300" />
          <p className="text-sm text-white/70">
            No winners yet. Press SPIN to draw.
          </p>
        </div>
      )}

      {prior.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <p className="font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.18em] text-white/40">
            Earlier draws
          </p>
          <ul className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {prior.map((w) => (
              <li
                key={w.id}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="font-[var(--font-geist-mono)] text-[10px] text-amber-300/70">
                  #{w.draw_index}
                </span>
                <span className="line-clamp-1 flex-1 text-white/90">
                  {w.entry_name}
                </span>
                <span className="line-clamp-1 text-xs text-white/45">
                  {w.department_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes confettiBurst {
          0% {
            transform: translate(-50%, -50%) rotate(var(--angle))
              translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) rotate(var(--angle))
              translateX(220px) scale(0.4);
            opacity: 0;
          }
        }
      `}</style>
    </aside>
  );
}
