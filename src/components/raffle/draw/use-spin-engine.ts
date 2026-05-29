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
  //   1. Starts rotating the wheel at constant velocity immediately.
  //   2. In parallel, calls drawWinner() to fetch the persisted winner.
  //   3. Once the server responds, decelerates into a landing where paddle 0
  //      sits at the front (angle ≡ 0 mod 360).
  // Running the server call in parallel keeps the wheel visibly moving the
  // whole time, so chained spins flow into each other instead of pausing on
  // a static "previous winner" frame while the next pick is being fetched.
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

      const drawPromise = drawWinner({
        raffle_id: config.raffleId,
        session_id: config.sessionId,
        department_id: drawArgs.departmentId,
        prize_label: drawArgs.prizeLabel,
        excluded_entry_ids: drawArgs.excludedEntryIds,
      });

      // Reduced motion: skip animation, snap to landing once we have a winner.
      if (prefersReducedMotion()) {
        const result = await drawPromise;
        if (result.error || !result.data) {
          setState((s) => ({ ...s, spinning: false }));
          return { error: result.error ?? "Draw failed." };
        }
        const winner = result.data;
        const startAngle = angleRef.current;
        const rotations = Math.max(3, config.spinsCount);
        const target =
          Math.ceil((startAngle + rotations * 360) / 360) * 360;
        angleRef.current = target;
        setState({ angle: target, spinning: false, landed: true });
        onTick?.(target);
        setTimeout(
          () => setState((s) => ({ ...s, landed: false })),
          1500,
        );
        return { winner };
      }

      const totalDurationMs = Math.max(1000, config.durationSeconds * 1000);
      // Lower bound on the deceleration phase so the landing always feels
      // intentional, even if the server responds nearly instantly.
      const minDecelMs = 1500;
      // ~2 rotations per second while we wait for the server. Matches the
      // average velocity the ease-out spin would reach early on.
      const velocityDegPerSec = 720;

      // Wrapped in an object so TS narrowing doesn't widen the type back to
      // the initial `null` after a closure mutation.
      const drawSlot: {
        value:
          | { winner: DrawWinnerResult }
          | { error: string }
          | null;
      } = { value: null };
      drawPromise.then((res) => {
        drawSlot.value =
          res.error || !res.data
            ? { error: res.error ?? "Draw failed." }
            : { winner: res.data };
      });

      const t0 = performance.now();
      let lastNow = t0;
      let phase: "constant" | "decel" = "constant";
      let decelStartAngle = 0;
      let decelTargetAngle = 0;
      let decelStartTime = 0;
      let decelDurationMs = 0;

      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          const dtSec = Math.max(0, (now - lastNow) / 1000);
          lastNow = now;

          if (phase === "constant") {
            const newAngle =
              angleRef.current + velocityDegPerSec * dtSec;
            angleRef.current = newAngle;
            setState((s) => ({ ...s, angle: newAngle }));
            onTick?.(newAngle);

            if (drawSlot.value) {
              if ("error" in drawSlot.value) {
                rafRef.current = null;
                resolve();
                return;
              }
              const elapsed = now - t0;
              const remainingMs = Math.max(
                minDecelMs,
                totalDurationMs - elapsed,
              );
              // Always glide through at least two more rotations before
              // landing at the next multiple of 360.
              decelStartAngle = newAngle;
              decelTargetAngle =
                Math.ceil((newAngle + 2 * 360) / 360) * 360;
              decelStartTime = now;
              decelDurationMs = remainingMs;
              phase = "decel";
            }
            rafRef.current = requestAnimationFrame(tick);
          } else {
            const elapsed = now - decelStartTime;
            const t = Math.min(1, elapsed / decelDurationMs);
            const eased = easeOutCubic(t);
            const angle =
              decelStartAngle + (decelTargetAngle - decelStartAngle) * eased;
            angleRef.current = angle;
            setState((s) => ({ ...s, angle }));
            onTick?.(angle);
            if (t < 1) {
              rafRef.current = requestAnimationFrame(tick);
            } else {
              rafRef.current = null;
              resolve();
            }
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

      const finalResult = drawSlot.value;
      if (finalResult === null || "error" in finalResult) {
        setState((s) => ({ ...s, spinning: false }));
        return { error: finalResult?.error ?? "Draw failed." };
      }

      angleRef.current = decelTargetAngle;
      setState({ angle: decelTargetAngle, spinning: false, landed: true });
      setTimeout(
        () => setState((s) => ({ ...s, landed: false })),
        1800,
      );

      return { winner: finalResult.winner };
    },
    [prefersReducedMotion],
  );

  return { state, spin };
}
