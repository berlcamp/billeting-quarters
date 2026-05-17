"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawWinner, type DrawWinnerResult } from "@/lib/actions/raffle";

// Easing: ease-out cubic — sharp acceleration at the start, gentle landing.
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export type SpinEngineConfig = {
  raffleId: string;
  sessionId: string;
  durationSeconds: number;
  spinsCount: number; // total rotations during the spin (e.g. 6 means ~6 full turns)
};

export type SpinEngineState = {
  angle: number; // current rotation angle in degrees
  spinning: boolean;
  landed: boolean; // true briefly after a spin completes — for confetti / pulse
};

export function useSpinEngine() {
  const [state, setState] = useState<SpinEngineState>({
    angle: 0,
    spinning: false,
    landed: false,
  });
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const prefersReducedMotion = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Performs one spin:
  //   1. Calls drawWinner() to fetch the persisted winner from the server.
  //   2. Animates the wheel for `durationSeconds`, ending at angle ≡ 0 (mod 360).
  //   3. Returns the winner so the caller can append to the winners list.
  // Throws (returns null) on server error — caller surfaces the message.
  const spin = useCallback(
    async (
      config: SpinEngineConfig,
      drawArgs: {
        departmentId?: string;
        prizeLabel?: string;
        excludedEntryIds: string[];
      },
      onTick?: (angle: number) => void,
    ): Promise<{ winner: DrawWinnerResult } | { error: string }> => {
      // Cancel any in-flight animation.
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

      setState((s) => ({ ...s, spinning: true, landed: false }));

      const result = await drawWinner({
        raffle_id: config.raffleId,
        session_id: config.sessionId,
        department_id: drawArgs.departmentId,
        prize_label: drawArgs.prizeLabel,
        excluded_entry_ids: drawArgs.excludedEntryIds,
      });

      if (result.error || !result.data) {
        setState((s) => ({ ...s, spinning: false }));
        return { error: result.error ?? "Draw failed." };
      }

      const winner = result.data;

      // Final angle target: complete N full rotations from the current angle,
      // then land at the next multiple of 360 so paddle 0 is at the front.
      const startAngle = angleRef.current;
      const rotations = Math.max(3, config.spinsCount);
      const target =
        Math.ceil((startAngle + rotations * 360) / 360) * 360;

      // Reduced motion: skip animation, snap to landing.
      if (prefersReducedMotion()) {
        angleRef.current = target;
        setState({ angle: target, spinning: false, landed: true });
        onTick?.(target);
        setTimeout(
          () => setState((s) => ({ ...s, landed: false })),
          1500,
        );
        return { winner };
      }

      const durationMs = Math.max(1000, config.durationSeconds * 1000);
      const t0 = performance.now();

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const elapsed = now - t0;
          const t = Math.min(1, elapsed / durationMs);
          const eased = easeOutCubic(t);
          const angle = startAngle + (target - startAngle) * eased;
          angleRef.current = angle;
          setState((s) => ({ ...s, angle }));
          onTick?.(angle);
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
            resolve();
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

      angleRef.current = target;
      setState({ angle: target, spinning: false, landed: true });
      setTimeout(
        () => setState((s) => ({ ...s, landed: false })),
        1800,
      );

      return { winner };
    },
    [prefersReducedMotion],
  );

  return { state, spin };
}
