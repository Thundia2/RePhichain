// ============================================================
// Latency Calibration — Phira-style falling note calibration
//
// Recent change: Fixed timing desync — clicks and note position
// now share a common cycleStartTime reference. Clicks fire at
// cycleStart + FALL_DURATION + N*LOOP_PERIOD (when the note
// crosses the judgment line). Note position is computed as
// elapsed time from cycleStart, so at offset=0 the visual and
// audio are perfectly aligned.
//
// Look: rows are UIKit CardRows inside the Settings card, actions
// are shared Buttons, and the canvas colours come from design
// tokens via chromeTheme (tap-note blue, status colours for taps).
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { CardRow } from "../common/UIKit";
import { Button } from "../common/Button";
import { chromeTheme, withAlpha } from "../../canvas/chromeTheme";

// ---- Calibration Configuration ----
const LATENCY_MIN_MS = -300;
const LATENCY_MAX_MS = 300;
const LATENCY_STEP_MS = 5;

// ---- Canvas / Visual Constants ----
const CANVAS_HEIGHT = 200;          // CSS pixels
const LINE_Y_OFFSET = 30;          // judgment line distance from bottom
const TOP_MARGIN = 20;             // note starting Y from top
const NOTE_WIDTH = 60;             // note visual width
const NOTE_HEIGHT = 8;             // note visual height
const NOTE_RADIUS = 3;             // rounded corners
const LINE_THICKNESS = 3;          // matches GameRenderer

// ---- Timing Constants ----
const LOOP_PERIOD = 2.0;           // seconds per cycle
const FALL_DURATION = 1.0;         // note falls for 1s out of 2s loop
const FLASH_DURATION = 0.08;       // hit flash duration in seconds
const TAP_FADE_DURATION = 0.6;     // tap feedback fade time in seconds

// ---- Audio Constants ----
const CLICK_FREQ_HZ = 1000;        // Click pitch
const CLICK_DURATION_S = 0.03;     // Click length (30ms)
const CLICK_VOLUME = 0.7;          // Click volume (0-1)
const SCHEDULE_AHEAD = 4.0;        // schedule clicks up to 4s ahead

// ---- Tap feedback entry ----
interface TapFeedback {
  y: number;       // canvas Y-position where the note was
  time: number;    // performance.now() / 1000 when the tap happened
}

type CalibrationMode = "idle" | "calibrating";

// ---- Schedule a metronome click on an AudioContext ----
function scheduleClick(ctx: AudioContext, when: number) {
  const osc = ctx.createOscillator();
  osc.frequency.value = CLICK_FREQ_HZ;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(CLICK_VOLUME, when);
  gain.gain.linearRampToValueAtTime(0, when + CLICK_DURATION_S);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + CLICK_DURATION_S);
}

export function LatencyCalibration() {
  const audioLatencyMs = useSettingsStore((s) => s.audioLatencyMs);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [mode, setMode] = useState<CalibrationMode>("idle");

  // Refs for calibration state (not triggering re-renders)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const nextScheduleTimeRef = useRef(0);
  const cycleStartRef = useRef(0);       // AudioContext time when the note cycle begins
  const tapFeedbacksRef = useRef<TapFeedback[]>([]);
  const initialOffsetRef = useRef(0);
  // Read offset from store each frame without re-rendering
  const offsetMsRef = useRef(audioLatencyMs);

  // Keep offsetMsRef in sync with the store value
  useEffect(() => {
    offsetMsRef.current = audioLatencyMs;
  }, [audioLatencyMs]);

  // ---- Cleanup ----
  const cleanup = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    tapFeedbacksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ---- Schedule a rolling batch of clicks ----
  const scheduleBatch = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const horizon = ctx.currentTime + SCHEDULE_AHEAD;
    while (nextScheduleTimeRef.current < horizon) {
      scheduleClick(ctx, nextScheduleTimeRef.current);
      nextScheduleTimeRef.current += LOOP_PERIOD;
    }
  }, []);

  // ---- Canvas draw loop ----
  const draw = useCallback(function drawFrame() {
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    const audioCtx = audioCtxRef.current;
    if (!canvas || !ctx2d || !audioCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const lineY = h - LINE_Y_OFFSET;
    const travelDistance = lineY - TOP_MARGIN;

    // Token colours: canvas background, tap-note blue (matches the
    // game renderer), status colours for tap accuracy.
    const theme = chromeTheme();

    ctx2d.save();
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Clear with the canvas background
    ctx2d.fillStyle = theme.canvasBg;
    ctx2d.fillRect(0, 0, w, h);

    // 2. Draw judgment line (near-white, full width)
    ctx2d.fillStyle = withAlpha(theme.textPrimary, 0.85);
    ctx2d.fillRect(0, lineY - LINE_THICKNESS / 2, w, LINE_THICKNESS);

    // 3. Compute note position relative to cycle start
    //    elapsed = time since cycle began
    //    offset shifts the note: positive offset → note arrives later (compensates for late audio)
    const elapsed = audioCtx.currentTime - cycleStartRef.current;
    const offsetSec = offsetMsRef.current / 1000;
    const t = ((elapsed - offsetSec) % LOOP_PERIOD + LOOP_PERIOD) % LOOP_PERIOD;

    // 4. Draw falling note (visible during first half of cycle)
    if (t < FALL_DURATION) {
      const progress = t / FALL_DURATION; // 0 at top, 1 at judgment line
      const noteY = TOP_MARGIN + progress * travelDistance;
      const noteX = w / 2;

      ctx2d.fillStyle = theme.noteTap;
      ctx2d.beginPath();
      ctx2d.roundRect(
        noteX - NOTE_WIDTH / 2,
        noteY - NOTE_HEIGHT / 2,
        NOTE_WIDTH,
        NOTE_HEIGHT,
        NOTE_RADIUS,
      );
      ctx2d.fill();
    }

    // 5. Hit flash — brief tap-colour glow when note crosses the line
    if (t >= FALL_DURATION && t < FALL_DURATION + FLASH_DURATION) {
      const flashProgress = (t - FALL_DURATION) / FLASH_DURATION;
      const flashAlpha = (1.0 - flashProgress) * 0.5;
      ctx2d.fillStyle = withAlpha(theme.noteTap, flashAlpha);
      ctx2d.fillRect(0, lineY - 10, w, 20);
    }

    // 6. Draw tap feedback lines (fade out)
    const now = performance.now() / 1000;
    const feedbacks = tapFeedbacksRef.current;
    for (let i = feedbacks.length - 1; i >= 0; i--) {
      const fb = feedbacks[i];
      const age = now - fb.time;
      if (age > TAP_FADE_DURATION) {
        feedbacks.splice(i, 1);
        continue;
      }
      const alpha = 1.0 - age / TAP_FADE_DURATION;
      const dist = Math.abs(fb.y - lineY);

      // Color by accuracy: success = perfect, warning = close, error = far
      const accuracyColor =
        dist < 8 ? theme.success : dist < 25 ? theme.warning : theme.error;
      ctx2d.fillStyle = withAlpha(accuracyColor, alpha);
      ctx2d.fillRect(0, fb.y - 1, w, 2);
    }

    ctx2d.restore();

    // 7. Schedule more clicks if needed
    scheduleBatch();

    // 8. Continue loop
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [scheduleBatch]);

  // ---- Set up canvas dimensions ----
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
  }, []);

  // ---- Start Calibration ----
  const startCalibration = useCallback(() => {
    // Capture initial offset for cancel support
    initialOffsetRef.current = useSettingsStore.getState().audioLatencyMs;
    tapFeedbacksRef.current = [];

    setMode("calibrating");

    // Defer canvas setup + audio start to after the canvas element mounts
    requestAnimationFrame(() => {
      setupCanvas();

      // Create dedicated AudioContext
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      ctx.resume(); // ensure running after user gesture

      // The cycle starts 0.2s from now (small buffer for AudioContext warmup).
      // Clicks fire when the note hits the line: at cycleStart + FALL_DURATION + N*LOOP_PERIOD.
      // This ensures that at offset=0 the visual note crossing and the audio click are aligned.
      const cycleStart = ctx.currentTime + 0.2;
      cycleStartRef.current = cycleStart;
      nextScheduleTimeRef.current = cycleStart + FALL_DURATION;
      scheduleBatch();

      // Start render loop
      rafRef.current = requestAnimationFrame(draw);
    });
  }, [setupCanvas, scheduleBatch, draw]);

  // ---- Handle Tap (during calibration) ----
  const handleTap = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const canvas = canvasRef.current;
    if (!audioCtx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const h = canvas.height / dpr;
    const lineY = h - LINE_Y_OFFSET;
    const travelDistance = lineY - TOP_MARGIN;

    // Compute where the note is right now (same formula as draw loop)
    const elapsed = audioCtx.currentTime - cycleStartRef.current;
    const offsetSec = offsetMsRef.current / 1000;
    const t = ((elapsed - offsetSec) % LOOP_PERIOD + LOOP_PERIOD) % LOOP_PERIOD;

    let noteY: number;
    if (t < FALL_DURATION) {
      const progress = t / FALL_DURATION;
      noteY = TOP_MARGIN + progress * travelDistance;
    } else {
      // Note already passed — show feedback at the judgment line
      noteY = lineY;
    }

    tapFeedbacksRef.current.push({
      y: noteY,
      time: performance.now() / 1000,
    });
  }, []);

  // ---- Stop Calibration (Done — keep offset) ----
  const stopCalibration = useCallback(() => {
    cleanup();
    setMode("idle");
  }, [cleanup]);

  // ---- Cancel Calibration (revert offset) ----
  const cancelCalibration = useCallback(() => {
    cleanup();
    updateSettings({ audioLatencyMs: initialOffsetRef.current });
    setMode("idle");
  }, [cleanup, updateSettings]);

  const offsetSlider = (label: string) => (
    <div className="flex items-center" style={{ gap: "var(--space-8)" }}>
      <input
        type="range"
        min={LATENCY_MIN_MS}
        max={LATENCY_MAX_MS}
        step={LATENCY_STEP_MS}
        value={audioLatencyMs}
        aria-label={label}
        onChange={(e) => updateSettings({ audioLatencyMs: parseInt(e.target.value) })}
        style={{ width: 96 }}
      />
      <span
        style={{
          fontSize: "var(--fs-control)",
          fontFamily: "var(--font-mono)",
          width: 52,
          textAlign: "right",
          color: "var(--text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {audioLatencyMs} ms
      </span>
    </div>
  );

  const actionRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-8)",
    padding: "var(--space-10) var(--space-12)",
  };

  // ---- IDLE state ----
  if (mode === "idle") {
    return (
      <div>
        {/* Manual slider row */}
        <CardRow label="Audio latency" description="Compensates for audio hardware delay">
          {offsetSlider("Audio latency")}
        </CardRow>

        {/* Calibrate + Reset buttons */}
        <div style={actionRowStyle}>
          <Button variant="primary" onClick={startCalibration}>
            Calibrate
          </Button>
          {audioLatencyMs !== 0 && (
            <Button onClick={() => updateSettings({ audioLatencyMs: 0 })}>
              Reset to 0
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- CALIBRATING state ----
  return (
    <div>
      {/* Canvas area */}
      <div ref={containerRef} style={{ lineHeight: 0 }}>
        <canvas
          ref={canvasRef}
          aria-label="Calibration preview. Tap or press Space to check timing."
          style={{
            width: "100%",
            height: CANVAS_HEIGHT,
            cursor: "pointer",
            display: "block",
            borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            handleTap();
          }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              handleTap();
            }
          }}
          tabIndex={0}
        />
      </div>

      {/* Instruction text */}
      <div
        style={{
          padding: "var(--space-8) var(--space-12) var(--space-4)",
          fontSize: "var(--fs-caption)",
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        Adjust until the note hits the line in sync with the sound. Tap to check timing.
      </div>

      {/* Live offset slider */}
      <CardRow label="Offset">
        {offsetSlider("Offset")}
      </CardRow>

      {/* Done / Cancel buttons */}
      <div style={actionRowStyle}>
        <Button variant="primary" onClick={stopCalibration}>
          Done
        </Button>
        <Button onClick={cancelCalibration}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
