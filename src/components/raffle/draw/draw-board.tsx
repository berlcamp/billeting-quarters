"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, Play, Settings, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WaterwheelSpinner } from "./waterwheel-spinner";
import { WinnersPanel } from "./winners-panel";
import { SettingsSheet, type DrawSettings } from "./settings-sheet";
import { useSpinEngine } from "./use-spin-engine";
import type { DrawWinnerResult } from "@/lib/actions/raffle";

type Entry = { id: string; name: string; department_id: string };
type Department = { id: string; name: string; entry_count: number };

interface Props {
  raffle: { id: string; name: string };
  departments: Department[];
  entries: Entry[];
  initialWinners?: DrawWinnerResult[];
}

const DEFAULT_SETTINGS: DrawSettings = {
  totalWinners: 5,
  spinDurationSeconds: 5,
  departmentId: "ALL",
  prizeLabel: "",
  autoSpin: false,
  autoSpinIntervalSeconds: 3,
};

export function DrawBoard({
  raffle,
  departments,
  entries,
  initialWinners = [],
}: Props) {
  // Lazy init — runs once on first render. Stable across re-renders, and
  // since the id is only used in server-action callbacks (never rendered as
  // text), a different SSR vs CSR value can't cause a hydration mismatch.
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  // Seed with persisted winners so they remain excluded from the pool across
  // page refreshes. Cleared server-side via "Clear winners".
  const [winners, setWinners] = useState<DrawWinnerResult[]>(initialWinners);
  const [winnerNameForWheel, setWinnerNameForWheel] = useState<string | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSpinPending, setAutoSpinPending] = useState(false);
  const autoSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { state: engine, spin } = useSpinEngine();

  const clearAutoSpinTimer = useCallback(() => {
    if (autoSpinTimerRef.current !== null) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }
    setAutoSpinPending(false);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSpinTimerRef.current !== null) {
        clearTimeout(autoSpinTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const eligibleEntries = useMemo(() => {
    const wonIds = new Set(winners.map((w) => w.entry_id));
    return entries.filter((e) => {
      if (wonIds.has(e.id)) return false;
      if (settings.departmentId !== "ALL" && e.department_id !== settings.departmentId)
        return false;
      return true;
    });
  }, [entries, winners, settings.departmentId]);

  const eligibleNames = useMemo(
    () => eligibleEntries.map((e) => e.name),
    [eligibleEntries],
  );

  const goalReached = winners.length >= settings.totalWinners;
  const poolEmpty = eligibleEntries.length === 0;
  const canSpin = !engine.spinning && !goalReached && !poolEmpty;

  const onSpin = useCallback(async () => {
    if (!canSpin) return;

    setAutoSpinPending(false);
    if (autoSpinTimerRef.current !== null) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }

    // Clear the previous winner-on-wheel so the new spin streams names again.
    setWinnerNameForWheel(null);

    const result = await spin(
      {
        raffleId: raffle.id,
        sessionId,
        durationSeconds: settings.spinDurationSeconds,
        spinsCount: 6,
      },
      {
        departmentId:
          settings.departmentId === "ALL" ? undefined : settings.departmentId,
        prizeLabel: settings.prizeLabel.trim() || undefined,
        excludedEntryIds: winners.map((w) => w.entry_id),
      },
    );

    if ("error" in result) {
      toast.error("Draw failed", { description: result.error });
      return;
    }

    setWinnerNameForWheel(result.winner.entry_name);
    setWinners((prev) => [...prev, result.winner]);

    const nextCount = winners.length + 1;
    const moreNeeded = nextCount < settings.totalWinners;
    const poolHasMore = eligibleEntries.length - 1 > 0;
    if (
      settings.autoSpin &&
      settings.totalWinners > 1 &&
      moreNeeded &&
      poolHasMore
    ) {
      setAutoSpinPending(true);
      const delayMs = Math.max(1, settings.autoSpinIntervalSeconds) * 1000;
      autoSpinTimerRef.current = setTimeout(() => {
        autoSpinTimerRef.current = null;
        setAutoSpinPending(false);
        void onSpinRef.current?.();
      }, delayMs);
    }
  }, [
    canSpin,
    spin,
    raffle.id,
    sessionId,
    settings,
    winners,
    eligibleEntries.length,
  ]);

  const onSpinRef = useRef<typeof onSpin | null>(null);
  useEffect(() => {
    onSpinRef.current = onSpin;
  }, [onSpin]);

  // If auto-spin gets disabled (or other settings make next spin invalid)
  // while a timer is pending, cancel the queued spin.
  useEffect(() => {
    if (!settings.autoSpin && autoSpinPending) {
      clearAutoSpinTimer();
    }
  }, [settings.autoSpin, autoSpinPending, clearAutoSpinTimer]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  function closeWindow() {
    window.close();
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden text-white">
      {/* page-wide background atmospherics */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[700px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,197,38,0.16), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[#f5c526]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-[#f5c526]"
      />

      {/* ───────────────────── banner ───────────────────── */}
      <header className="relative z-10 flex items-start justify-between gap-4 px-8 pt-6">
        <div className="flex items-center gap-4">
          <span
            className="grid size-12 place-items-center rounded-md border border-white/15 bg-white/[0.04] text-[22px] font-medium text-[#f5c526]"
            style={{ fontFamily: "var(--font-fraunces), serif" }}
            aria-hidden
          >
            P
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.28em] text-white/55">
              Palaro 2026 · Agusan del Sur · Electronic Raffle Draw
            </span>
            <h1
              className="text-3xl leading-tight"
              style={{ fontFamily: "var(--font-fraunces), serif" }}
            >
              <span className="text-white">{raffle.name}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SettingsSheet
            settings={settings}
            onChange={setSettings}
            departments={departments}
            trigger={
              <Button
                size="icon"
                variant="outline"
                className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="size-4" />
              </Button>
            }
          />
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="border-white/15 bg-white/[0.04] text-white hover:bg-white/10"
            onClick={closeWindow}
            aria-label="Close"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      {/* ───────────────────── stage ───────────────────── */}
      <main className="relative z-10 mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-8 pb-8 pt-6 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-sm">
          {/* status strip */}
          <div className="flex w-full flex-wrap items-center justify-between gap-2 px-2 pt-2 font-[var(--font-geist-mono)] text-[10px] uppercase tracking-[0.22em] text-white/55">
            <span>
              Pool:{" "}
              <span className="text-white/90">{eligibleEntries.length}</span> ·{" "}
              {settings.departmentId === "ALL"
                ? "All departments"
                : departments.find((d) => d.id === settings.departmentId)
                    ?.name ?? "—"}
            </span>
            <span>
              Spin · {settings.spinDurationSeconds.toFixed(1)}s
            </span>
          </div>

          <WaterwheelSpinner
            angle={engine.angle}
            names={eligibleNames}
            winnerName={engine.spinning ? null : winnerNameForWheel}
            spinning={engine.spinning}
          />

          {/* SPIN button */}
          <div className="flex w-full flex-col items-center gap-3">
            {autoSpinPending ? (
              <Button
                onClick={clearAutoSpinTimer}
                className="group h-16 min-w-[260px] gap-3 rounded-full border-2 border-red-300/60 bg-gradient-to-r from-red-500 to-red-600 text-xl font-semibold text-white shadow-[0_0_40px_rgba(239,68,68,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                <Square className="size-5 fill-current" />
                Stop auto-spin
              </Button>
            ) : (
              <Button
                onClick={onSpin}
                disabled={!canSpin}
                className="group h-16 min-w-[260px] gap-3 rounded-full border-2 border-amber-300/60 bg-gradient-to-r from-amber-400 to-amber-500 text-xl font-semibold text-[#0a1740] shadow-[0_0_40px_rgba(245,197,38,0.45)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                style={{ fontFamily: "var(--font-fraunces), serif" }}
              >
                <Play className="size-6 fill-current" />
                {engine.spinning ? "Spinning…" : "Spin"}
              </Button>
            )}

            <p className="text-xs text-white/45">
              {poolEmpty
                ? "No eligible entries left in the pool."
                : goalReached
                  ? `All ${settings.totalWinners} winners drawn. Change settings to draw more.`
                  : autoSpinPending
                    ? `Next spin in ~${settings.autoSpinIntervalSeconds.toFixed(1)}s · ${winners.length} of ${settings.totalWinners} drawn.`
                    : settings.autoSpin && settings.totalWinners > 1
                      ? `Auto-spin on · ${winners.length} of ${settings.totalWinners} winners drawn.`
                      : `${winners.length} of ${settings.totalWinners} winners drawn.`}
            </p>
          </div>
        </section>

        <WinnersPanel
          winners={winners}
          totalGoal={settings.totalWinners}
          landed={engine.landed}
        />
      </main>
    </div>
  );
}
