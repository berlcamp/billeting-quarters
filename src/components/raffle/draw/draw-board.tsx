"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Settings,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DESIGNATION_TEASE_MS,
  WaterwheelSpinner,
  type SpinnerEntry,
} from "./waterwheel-spinner";
import { WinnersPanel } from "./winners-panel";
import { SettingsSheet, type DrawSettings } from "./settings-sheet";
import { useSpinEngine } from "./use-spin-engine";
import type { DrawWinnerResult } from "@/lib/actions/raffle";

type Entry = {
  id: string;
  name: string;
  designation: string | null;
  department_id: string;
};
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
  designationSuspense: true,
};

export function DrawBoard({
  raffle,
  departments,
  entries,
  initialWinners = [],
}: Props) {
  // Rotated on "New draw" so each visible draw run starts at draw_index=1 and
  // has a clean local winners list. The id is only used in server-action
  // callbacks (never rendered as text), so SSR/CSR mismatch isn't a concern.
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);
  // All persisted winners for this raffle. Drives pool exclusion so prior
  // winners can never be drawn again until an admin runs "Clear winners".
  const [winners, setWinners] = useState<DrawWinnerResult[]>(initialWinners);
  const [winnerForWheel, setWinnerForWheel] = useState<SpinnerEntry | null>(
    null,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoSpinPending, setAutoSpinPending] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  // `settings.totalWinners` is treated as a *batch* size, not a session cap.
  // When a batch completes, the next Spin starts a new batch — this is the
  // session-winners count at the moment the current batch began.
  const [batchStartCount, setBatchStartCount] = useState(0);
  const autoSpinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Winners whose name hasn't been revealed on the wheel yet — hidden from the
  // sidebar until the designation tease finishes so the wheel announces first.
  const [hiddenWinnerIds, setHiddenWinnerIds] = useState<Set<string>>(
    () => new Set(),
  );
  // Drives the sidebar's "just landed" confetti. Decoupled from engine.landed
  // because deferred reveals need their own flash window.
  const [sidebarLanded, setSidebarLanded] = useState(false);
  const revealTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sidebarLandedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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
      revealTimersRef.current.forEach((t) => clearTimeout(t));
      revealTimersRef.current = [];
      if (sidebarLandedTimerRef.current !== null) {
        clearTimeout(sidebarLandedTimerRef.current);
      }
    };
  }, []);

  const flashSidebarLanded = useCallback(() => {
    if (sidebarLandedTimerRef.current !== null) {
      clearTimeout(sidebarLandedTimerRef.current);
    }
    setSidebarLanded(true);
    sidebarLandedTimerRef.current = setTimeout(() => {
      setSidebarLanded(false);
      sidebarLandedTimerRef.current = null;
    }, 1800);
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

  const eligibleSpinnerEntries = useMemo<SpinnerEntry[]>(
    () =>
      eligibleEntries.map((e) => ({
        name: e.name,
        designation: e.designation,
      })),
    [eligibleEntries],
  );

  // Visible "this draw" list — filtered to the current session. Prior-session
  // winners stay in `winners` to keep them excluded from the pool, but they
  // shouldn't show on the stage or count against this draw's goal.
  const sessionWinners = useMemo(
    () => winners.filter((w) => w.session_id === sessionId),
    [winners, sessionId],
  );
  // What the sidebar actually renders — drops winners still mid-tease so the
  // wheel reveal lands before the same entry shows up beside it.
  const visibleSessionWinners = useMemo(
    () => sessionWinners.filter((w) => !hiddenWinnerIds.has(w.id)),
    [sessionWinners, hiddenWinnerIds],
  );

  const drawnInBatch = Math.max(0, sessionWinners.length - batchStartCount);
  const batchComplete = drawnInBatch >= settings.totalWinners;
  const poolEmpty = eligibleEntries.length === 0;
  // Goal-already-reached no longer disables Spin — the next click just starts
  // a new batch of `totalWinners`. Only the pool / spinning state can block.
  const canSpin = !engine.spinning && !poolEmpty;
  const disabledReason = engine.spinning
    ? null
    : poolEmpty
      ? settings.departmentId === "ALL"
        ? "No eligible entries left in the pool."
        : "No eligible entries for this department."
      : null;

  const onSpin = useCallback(async () => {
    if (!canSpin) return;

    setAutoSpinPending(false);
    if (autoSpinTimerRef.current !== null) {
      clearTimeout(autoSpinTimerRef.current);
      autoSpinTimerRef.current = null;
    }

    // If the previous batch already met its goal, this Spin starts a new
    // batch — count progress from now, not from the start of the session.
    const effectiveBatchStart = batchComplete
      ? sessionWinners.length
      : batchStartCount;
    if (effectiveBatchStart !== batchStartCount) {
      setBatchStartCount(effectiveBatchStart);
    }

    // Clear the previous winner-on-wheel so the new spin streams names again.
    setWinnerForWheel(null);

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

    setWinnerForWheel({
      name: result.winner.entry_name,
      designation: result.winner.entry_designation,
    });
    setWinners((prev) => [...prev, result.winner]);

    const winnerHasDesignation =
      !!result.winner.entry_designation?.trim();
    if (settings.designationSuspense && winnerHasDesignation) {
      const winnerId = result.winner.id;
      setHiddenWinnerIds((prev) => {
        const next = new Set(prev);
        next.add(winnerId);
        return next;
      });
      const t = setTimeout(() => {
        setHiddenWinnerIds((prev) => {
          if (!prev.has(winnerId)) return prev;
          const next = new Set(prev);
          next.delete(winnerId);
          return next;
        });
        flashSidebarLanded();
        revealTimersRef.current = revealTimersRef.current.filter(
          (timer) => timer !== t,
        );
      }, DESIGNATION_TEASE_MS);
      revealTimersRef.current.push(t);
    } else {
      flashSidebarLanded();
    }

    const nextDrawnInBatch = sessionWinners.length + 1 - effectiveBatchStart;
    const moreNeeded = nextDrawnInBatch < settings.totalWinners;
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
    sessionWinners.length,
    batchStartCount,
    batchComplete,
    eligibleEntries.length,
    flashSidebarLanded,
  ]);

  const resetDraw = useCallback(() => {
    clearAutoSpinTimer();
    revealTimersRef.current.forEach((t) => clearTimeout(t));
    revealTimersRef.current = [];
    if (sidebarLandedTimerRef.current !== null) {
      clearTimeout(sidebarLandedTimerRef.current);
      sidebarLandedTimerRef.current = null;
    }
    setHiddenWinnerIds(new Set());
    setSidebarLanded(false);
    setWinnerForWheel(null);
    setBatchStartCount(0);
    setSessionId(crypto.randomUUID());
    setResetConfirmOpen(false);
  }, [clearAutoSpinTimer]);

  function requestReset() {
    if (sessionWinners.length === 0) {
      resetDraw();
    } else {
      setResetConfirmOpen(true);
    }
  }

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
            onClick={requestReset}
            aria-label="New draw"
            title="New draw (clear stage, keep history)"
          >
            <RotateCcw className="size-4" />
          </Button>
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
          <WaterwheelSpinner
            angle={engine.angle}
            entries={eligibleSpinnerEntries}
            winner={engine.spinning ? null : winnerForWheel}
            spinning={engine.spinning}
            suspense={settings.designationSuspense}
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
                Pause auto-spin
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
              {disabledReason
                ? disabledReason
                : autoSpinPending
                  ? `Next spin in ~${settings.autoSpinIntervalSeconds.toFixed(1)}s · ${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`
                  : batchComplete
                    ? `Batch of ${settings.totalWinners} complete · ${sessionWinners.length} total. Click Spin to draw another ${settings.totalWinners}.`
                    : settings.autoSpin && settings.totalWinners > 1
                      ? `Auto-spin on · ${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`
                      : `${drawnInBatch} of ${settings.totalWinners} drawn · ${sessionWinners.length} total.`}
            </p>
          </div>
        </section>

        <WinnersPanel winners={visibleSessionWinners} landed={sidebarLanded} />
      </main>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new draw?</DialogTitle>
            <DialogDescription>
              This clears the {sessionWinners.length} winner
              {sessionWinners.length === 1 ? "" : "s"} on screen and starts a
              fresh draw. The dashboard winners list is unchanged, and anyone
              who already won stays excluded from the pool.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={resetDraw}>
              <RotateCcw className="size-4" />
              Start new draw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
