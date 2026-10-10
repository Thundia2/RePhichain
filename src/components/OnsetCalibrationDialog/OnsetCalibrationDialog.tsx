// ============================================================
// Onset Calibration Dialog
//
// Modal wizard for tuning the ddc_onset peak-picker on 4
// representative windows of the loaded song (Dense, Medium,
// Sparse, Quiet). Each window renders a canvas with the CNN
// salience envelope + current pick markers; the four
// peak-picker sliders live below and update every panel in
// real-time (no Rust re-run — the raw salience is cached).
//
// Recent change: Created for Phase C of onset plan (2026-04-20).
// Replaces the deleted flux-based CalibrationDialog. Uses the
// ddc_onset CNN output via `getCachedOnsetResults()` instead of
// computing spectral flux on open; swaps the single sensitivity
// slider for the four Phase A fields (target density, abs floor,
// adaptive delta, min display strength) plus a density-preset
// chip row labelled with ddc_onset's DDR difficulty tiers.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, ChevronRight, Play, Square } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAudioStore } from "../../stores/audioStore";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useToastStore } from "../../stores/toastStore";
import { audioEngine } from "../../audio/audioEngine";
import {
  peakPickT1,
  getCachedOnsetResults,
} from "../../hooks/useOnsetDetection";
import { analyzeRegions, type OnsetRegion, type RegionLabel } from "../../utils/onsetRegionAnalyzer";
import { BpmList } from "../../utils/bpmList";
import { beatToFloat } from "../../types/chart";
import { snapBeat } from "../../utils/beat";
import type { OnsetResult } from "../../utils/ipc";
import { chromeTheme, withAlpha, type ChromeTheme } from "../../canvas/chromeTheme";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import { Kbd } from "../common/Kbd";
import { SegmentedControl } from "../common/SegmentedControl";
import { Tooltip } from "../common/Tooltip";

// ── Look ───────────────────────────────────────────────────────
// Shared <Dialog> chrome; everything inside uses design tokens.
// Region previews are bg-active cards; the salience envelope and
// pick markers are drawn in the domain --onset-color, the playhead
// in --indicator-color (via chromeTheme for the canvases).

const FRAME_RATE = 100; // Matches ONSET_PIPELINE_VERSION = 2 on the Rust side.

/** Sentence-case display names for the analyzer's region labels. */
const LABEL_TEXT: Record<RegionLabel, string> = {
  DENSE: "Dense",
  MEDIUM: "Medium",
  SPARSE: "Sparse",
  QUIET: "Quiet",
};

/** Envelope colour per region: onset colour, except QUIET which fades to
 *  neutral so it doesn't compete for attention. */
function regionTint(label: RegionLabel, t: ChromeTheme): string {
  return label === "QUIET" ? t.textSecondary : t.onsetColor;
}

/** Canvas dimensions in CSS pixels (devicePixelRatio scaled at draw time). */
const CANVAS_W = 304;
const CANVAS_H = 92;

/** Density presets for the chip row. Numbers match the per-difficulty
 *  output density observed on `Sell a Friend.mp3` in the experiment — see
 *  `test/out_ddc/summary.json`. Labels mirror ddc_onset's DDR difficulty
 *  tiers for recognizability, even though we use density budget internally. */
const DENSITY_PRESETS: Array<{ label: string; density: number; tooltip: string }> = [
  { label: "Beginner", density: 1.6, tooltip: "Sparse — one marker every ~2 beats at 180 BPM" },
  { label: "Easy",     density: 2.6, tooltip: "Lightly dense — on-beat + selected half-beats" },
  { label: "Medium",   density: 3.3, tooltip: "~One marker per beat at 180 BPM" },
  { label: "Hard",     density: 4.5, tooltip: "Eighth-note-heavy" },
  { label: "Challenge", density: 5.7, tooltip: "Maximum density — dense 16th-note coverage" },
];

// ── Styles ────────────────────────────────────────────────────

const STAT_LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--text-secondary)",
  marginBottom: "var(--space-2)",
};

const STAT_VALUE_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-headline)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

const ROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  color: "var(--text-secondary)",
  flexShrink: 0,
};

const VALUE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--fs-control)",
  color: "var(--text-primary)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

// ── Component ─────────────────────────────────────────────────

interface OnsetCalibrationDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OnsetCalibrationDialog({ open, onClose }: OnsetCalibrationDialogProps) {
  // Settings read directly from the store (live subscriptions so the
  // canvases re-render as the user drags sliders).
  const targetDensity = useSettingsStore((s) => s.onsetTargetDensity);
  const absFloor = useSettingsStore((s) => s.onsetAbsFloor);
  const adaptiveDelta = useSettingsStore((s) => s.onsetAdaptiveDelta);
  const minDisplayStrength = useSettingsStore((s) => s.onsetMinDisplayStrength);
  const snapToGrid = useSettingsStore((s) => s.onsetSnapToGrid);
  const chartOnsetTargetDensity = useChartStore((s) => s.chart.onset_target_density);
  const onsetEnabled = useSettingsStore((s) => s.onsetDetectionEnabled);
  const onsetAnalyzing = useEditorStore((s) => s.onsetAnalyzing);
  // Subscribing to onsetMarkers is our proxy for "raw cache was updated" —
  // whenever the hook's Effect B runs, markers change, and we re-read
  // getCachedOnsetResults() for a fresh snapshot.
  const markersEpoch = useEditorStore((s) => s.onsetMarkers);

  // Effective density matches the hook's resolution logic — per-chart wins.
  const effectiveDensity = chartOnsetTargetDensity ?? targetDensity;

  // Local region state, recomputed when the cache snapshot changes.
  const [regions, setRegions] = useState<OnsetRegion[] | null>(null);
  const [rawResults, setRawResults] = useState<readonly OnsetResult[] | null>(null);
  const [playingRegion, setPlayingRegion] = useState<RegionLabel | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Region (re)computation on open / cache update ──
  useEffect(() => {
    if (!open) return;
    const results = getCachedOnsetResults();
    setRawResults(results);
    if (results === null || results.length === 0) {
      setRegions(null);
      return;
    }
    setRegions(analyzeRegions(results, FRAME_RATE));
    // markersEpoch is intentionally in the dep list — it changes whenever
    // the underlying cache does, giving us a subscription without the
    // overhead of a separate Zustand store. See getCachedOnsetResults() docs.
  }, [open, markersEpoch]);

  // ── Keyboard shortcut: Enter applies (same as old dialog). Esc is
  //     handled by <Dialog>, which calls handleClose. ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Clean up any preview timer on unmount / close.
  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
      audioEngine.pause();
    }
    setPlayingRegion(null);
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    useToastStore.getState().addToast({
      message: `Onset settings applied — target ${effectiveDensity.toFixed(1)}/sec`,
      type: "success",
    });
    handleClose();
  }, [effectiveDensity, handleClose]);

  // ── Preset chip click: write per-chart density if a chart is loaded,
  //     otherwise tweak the global setting. Matches the slider's write path
  //     in GlobalMode.tsx. ──
  const applyDensityPreset = useCallback((density: number) => {
    useChartStore.getState().setOnsetTargetDensity(density);
  }, []);

  // ── Play-region preview: seek + play + auto-stop after region length. ──
  const handlePlayRegion = useCallback((region: OnsetRegion) => {
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    if (playingRegion === region.label) {
      audioEngine.pause();
      setPlayingRegion(null);
      return;
    }
    audioEngine.seek(region.startTime);
    audioEngine.play();
    setPlayingRegion(region.label);
    // O8: scale the auto-stop timeout by the playback rate — a region of length L played
    // at 2× finishes in L/2 real seconds, so a rate-1 timeout kept playing past the region.
    const rate = useAudioStore.getState().playbackRate || 1;
    const ms = ((region.endTime - region.startTime) * 1000) / rate;
    playTimerRef.current = setTimeout(() => {
      audioEngine.pause();
      setPlayingRegion(null);
      playTimerRef.current = null;
    }, ms);
  }, [playingRegion]);

  // ── Total pick count across the whole song (for the header stat). ──
  const songTotalPicks = useMemo(() => {
    if (!rawResults) return 0;
    const cs = useChartStore.getState();
    const bl = new BpmList(cs.chart.bpm_list);
    // Mirror the hook's peak-picker config so the stat matches the editor.
    const snapFrameToCell = snapToGrid
      ? (frame: number) => {
          const tSec = frame / FRAME_RATE;
          const beat = bl.beatAtFloat(tSec - cs.chart.offset);
          const density = useEditorStore.getState().density;
          const snapped = beatToFloat(snapBeat(beat, density));
          return String(Math.round(snapped * 10000));
        }
      : undefined;
    const picks = peakPickT1(
      rawResults as OnsetResult[],
      absFloor,
      adaptiveDelta,
      effectiveDensity,
      (t) => bl.bpmAtTime(t),
      snapFrameToCell,
    );
    return minDisplayStrength > 0
      ? picks.filter((p) => p.probability >= minDisplayStrength).length
      : picks.length;
  }, [rawResults, absFloor, adaptiveDelta, effectiveDensity, minDisplayStrength, snapToGrid]);

  const duration = useAudioStore((s) => s.duration);

  if (!open) return null;

  const activePreset =
    DENSITY_PRESETS.find((preset) => Math.abs(effectiveDensity - preset.density) < 0.06)?.label ?? null;

  return (
    <Dialog
      title="Onset calibration"
      icon={AudioWaveform}
      onClose={handleClose}
      width={680}
      bodyStyle={{ display: "flex", flexDirection: "column", gap: "var(--space-14)" }}
      footer={
        <>
          <span
            style={{
              marginRight: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-4)",
              fontSize: "var(--fs-caption)",
              color: "var(--text-secondary)",
            }}
          >
            <Kbd>Esc</Kbd> close · <Kbd>Enter</Kbd> apply
          </span>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleApply}>Apply</Button>
        </>
      }
    >
      {/* ── Stats strip ── */}
      <div style={{ display: "flex", gap: "var(--space-20)", alignItems: "flex-end" }}>
        <div>
          <div style={STAT_LABEL_STYLE}>Markers</div>
          <div style={STAT_VALUE_STYLE}>
            {onsetAnalyzing
              ? "…"
              : regions === null
              ? "–"
              : songTotalPicks.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={STAT_LABEL_STYLE}>Density</div>
          <div style={STAT_VALUE_STYLE}>
            {effectiveDensity.toFixed(2)}
            <span style={{ fontSize: "var(--fs-caption)", fontWeight: 400, color: "var(--text-secondary)", marginLeft: "var(--space-4)" }}>/s</span>
          </div>
        </div>
        <div>
          <div style={STAT_LABEL_STYLE}>Duration</div>
          <div style={STAT_VALUE_STYLE}>
            {duration > 0 ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, "0")}` : "–"}
          </div>
        </div>
        <div>
          <div style={STAT_LABEL_STYLE}>Source</div>
          <div
            style={{
              ...STAT_VALUE_STYLE,
              fontFamily: "inherit",
              fontSize: "var(--fs-body)",
              color: chartOnsetTargetDensity !== undefined ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
          >
            {chartOnsetTargetDensity !== undefined ? "Per-chart" : "Global"}
          </div>
        </div>
      </div>

      {/* ── Density preset row ─────────────────────────────────
           The main tuning action: click a preset to set density to a
           named difficulty tier. The matching preset shows selected. */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
        <span style={{ ...ROW_LABEL_STYLE, minWidth: 56 }}>Preset</span>
        <SegmentedControl
          tone="accent"
          block
          label="Density preset"
          value={activePreset}
          onChange={(label) => {
            const preset = DENSITY_PRESETS.find((p) => p.label === label);
            if (preset) applyDensityPreset(preset.density);
          }}
          options={DENSITY_PRESETS.map((preset) => ({
            value: preset.label,
            title: preset.tooltip,
            label: (
              <>
                {preset.label}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-caption)", opacity: 0.75 }}>
                  {preset.density.toFixed(1)}
                </span>
              </>
            ),
          }))}
          style={{ flex: 1 }}
        />
      </div>

      {/* ── Target density slider (the fine-grained knob) ────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
        <span style={{ ...ROW_LABEL_STYLE, minWidth: 56 }}>Density</span>
        <input
          type="range" min={0.5} max={8.0} step={0.1}
          value={effectiveDensity}
          onChange={(e) => useChartStore.getState().setOnsetTargetDensity(parseFloat(e.target.value))}
          style={{ flex: 1 }}
          aria-label="Target onset density in onsets per second"
        />
        <span style={{ ...VALUE_STYLE, minWidth: 52 }}>
          {effectiveDensity.toFixed(1)} /s
        </span>
      </div>

      {/* ── Region grid (2x2) ──────────────────────────────────
           Renders 4 canvases showing CNN salience + pick markers for
           each representative region of the song. Selecting a region
           starts audition playback; the canvas overlays the playhead
           during playback. */}
      <div style={{ minHeight: 196 }}>
        {!onsetEnabled ? (
          <EmptyState message="Onset detection is off" sub="Turn it on in the sidebar to analyze this song, then re-open calibration." />
        ) : onsetAnalyzing || (rawResults === null) ? (
          <EmptyState
            message={onsetAnalyzing ? "Analyzing audio…" : "No cached results"}
            sub={onsetAnalyzing ? "One-time ~2 s CNN pass over the song." : "Load a song with onset detection enabled first."}
            pulse={onsetAnalyzing}
          />
        ) : regions && regions.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-10)" }}>
            {regions.map((region) => (
              <RegionPanel
                key={region.label}
                region={region}
                rawResults={rawResults}
                effectiveDensity={effectiveDensity}
                absFloor={absFloor}
                adaptiveDelta={adaptiveDelta}
                minDisplayStrength={minDisplayStrength}
                snapToGrid={snapToGrid}
                isPlaying={playingRegion === region.label}
                onPlay={() => handlePlayRegion(region)}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="Song too short" sub="Calibration needs at least ~12 seconds of non-silent audio." />
        )}
      </div>

      {/* ── Advanced sliders (collapsible) ─────────────────── */}
      <AdvancedSliders
        absFloor={absFloor}
        adaptiveDelta={adaptiveDelta}
        minDisplayStrength={minDisplayStrength}
        snapToGrid={snapToGrid}
      />
    </Dialog>
  );
}

// ── Empty-state helper ─────────────────────────────────────────

function EmptyState({ message, sub, pulse }: { message: string; sub: string; pulse?: boolean }) {
  return (
    <div
      className={pulse ? "ui-pulse" : undefined}
      aria-busy={pulse || undefined}
      style={{
        height: 196,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        backgroundColor: "var(--bg-active)",
        borderRadius: "var(--radius-xl)",
      }}
    >
      <div style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text-primary)" }}>{message}</div>
      <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", maxWidth: 360, textAlign: "center" }}>
        {sub}
      </div>
    </div>
  );
}

// ── Advanced sliders section (collapsible) ─────────────────────

function AdvancedSliders({
  absFloor,
  adaptiveDelta,
  minDisplayStrength,
  snapToGrid,
}: {
  absFloor: number;
  adaptiveDelta: number;
  minDisplayStrength: number;
  snapToGrid: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "var(--rule) solid var(--separator)", paddingTop: "var(--space-10)" }}>
      <button
        type="button"
        className="ui-btn ui-btn--ghost ui-btn--sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ marginLeft: "calc(-1 * var(--space-6))", marginBottom: open ? "var(--space-10)" : 0 }}
      >
        <Icon
          icon={ChevronRight}
          size={12}
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform var(--dur-base)" }}
        />
        Advanced
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <AdvancedRow
            label="Min str"
            hint="Hide markers below this salience (visual only)."
            value={minDisplayStrength}
            min={0} max={1} step={0.01}
            onChange={(v) => useSettingsStore.getState().updateSettings({ onsetMinDisplayStrength: v })}
            format={(v) => v.toFixed(2)}
          />
          <AdvancedRow
            label="Abs floor"
            hint="Absolute threshold floor. A peak must clear both this AND rolling-median + delta."
            value={absFloor}
            min={0} max={1} step={0.01}
            onChange={(v) => useSettingsStore.getState().updateSettings({ onsetAbsFloor: v })}
            format={(v) => v.toFixed(2)}
          />
          <AdvancedRow
            label="Adapt Δ"
            hint="Added to the 1-sec rolling median to form the per-frame adaptive threshold."
            value={adaptiveDelta}
            min={0} max={0.2} step={0.005}
            onChange={(v) => useSettingsStore.getState().updateSettings({ onsetAdaptiveDelta: v })}
            format={(v) => v.toFixed(3)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => useSettingsStore.getState().updateSettings({ onsetSnapToGrid: e.target.checked })}
            />
            <span style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)" }}>
              Snap to beat grid
            </span>
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
              (collapses pick candidates onto the current grid density)
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function AdvancedRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <Tooltip content={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
        <span style={{ ...ROW_LABEL_STYLE, minWidth: 64 }}>{label}</span>
        <input
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1 }}
          aria-label={label}
        />
        <span style={{ ...VALUE_STYLE, color: "var(--text-secondary)", minWidth: 48 }}>
          {format(value)}
        </span>
      </div>
    </Tooltip>
  );
}

// ── Region panel (canvas + overlays) ───────────────────────────

interface RegionPanelProps {
  region: OnsetRegion;
  rawResults: readonly OnsetResult[];
  effectiveDensity: number;
  absFloor: number;
  adaptiveDelta: number;
  minDisplayStrength: number;
  snapToGrid: boolean;
  isPlaying: boolean;
  onPlay: () => void;
}

function RegionPanel({
  region,
  rawResults,
  effectiveDensity,
  absFloor,
  adaptiveDelta,
  minDisplayStrength,
  snapToGrid,
  isPlaying,
  onPlay,
}: RegionPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Compute the picks inside THIS region's time range. We re-pick on every
  // slider change — the full-song picker is O(n) per run and a 6-second
  // window gives us ~600 frames so this is trivial (<1 ms per panel).
  const regionPicks = useMemo(() => {
    const cs = useChartStore.getState();
    const bl = new BpmList(cs.chart.bpm_list);
    const snapFrameToCell = snapToGrid
      ? (frame: number) => {
          const tSec = frame / FRAME_RATE;
          const beat = bl.beatAtFloat(tSec - cs.chart.offset);
          const density = useEditorStore.getState().density;
          const snapped = beatToFloat(snapBeat(beat, density));
          return String(Math.round(snapped * 10000));
        }
      : undefined;
    const allPicks = peakPickT1(
      rawResults as OnsetResult[],
      absFloor,
      adaptiveDelta,
      effectiveDensity,
      (t) => bl.bpmAtTime(t),
      snapFrameToCell,
    );
    const inRegion = allPicks.filter(
      (p) => p.time >= region.startTime && p.time < region.endTime,
    );
    return minDisplayStrength > 0
      ? inRegion.filter((p) => p.probability >= minDisplayStrength)
      : inRegion;
  }, [rawResults, region.startTime, region.endTime, effectiveDensity, absFloor, adaptiveDelta, minDisplayStrength, snapToGrid]);

  // Canvas rendering — runs on settings changes and during playback frames.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const theme = chromeTheme();

    function draw() {
      if (!ctx) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Background: same fill as the surrounding card (tokens via chromeTheme).
      ctx.fillStyle = theme.bgActive;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const regionDuration = region.endTime - region.startTime;
      const frameCount = region.frameEndIdx - region.frameStartIdx;
      const labelColor = regionTint(region.label, theme);

      // ── Layer 1: CNN salience envelope (faint bars at each frame) ──
      // We draw every frame at its column, scaled to local max so the
      // visualization is useful even for low-probability regions.
      if (frameCount > 0) {
        let localMax = 0;
        for (let i = region.frameStartIdx; i < region.frameEndIdx; i++) {
          const p = rawResults[i]?.probability ?? 0;
          if (p > localMax) localMax = p;
        }
        if (localMax > 0) {
          for (let px = 0; px < CANVAS_W; px++) {
            const t = px / CANVAS_W;
            const frameIdx = Math.floor(region.frameStartIdx + t * frameCount);
            if (frameIdx >= region.frameEndIdx) continue;
            const val = (rawResults[frameIdx]?.probability ?? 0) / localMax;
            const barH = val * (CANVAS_H - 14);
            ctx.fillStyle = labelColor;
            ctx.globalAlpha = 0.08 + val * 0.22;
            ctx.fillRect(px, CANVAS_H - barH - 2, 1, barH);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Layer 2: baseline line ──
      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H - 1.5);
      ctx.lineTo(CANVAS_W, CANVAS_H - 1.5);
      ctx.stroke();

      // ── Layer 3: Onset pick markers (vertical ticks sized by strength) ──
      for (const pick of regionPicks) {
        const x = ((pick.time - region.startTime) / regionDuration) * CANVAS_W;
        const strength = pick.probability;
        const alpha = 0.30 + strength * 0.65;
        const h = 14 + strength * (CANVAS_H - 22);

        ctx.strokeStyle = withAlpha(theme.onsetColor, alpha);
        ctx.lineWidth = Math.max(0.9, strength * 2);
        ctx.beginPath();
        ctx.moveTo(x, CANVAS_H - h);
        ctx.lineTo(x, CANVAS_H - 2);
        ctx.stroke();

        // Strong picks get a tiny cap triangle — mirrors the old dialog's
        // "bold onsets stand out" affordance.
        if (strength > 0.4) {
          ctx.fillStyle = withAlpha(theme.onsetColor, alpha * 0.8);
          ctx.beginPath();
          ctx.moveTo(x - 2.6, CANVAS_H - h);
          ctx.lineTo(x, CANVAS_H - h - 4.2);
          ctx.lineTo(x + 2.6, CANVAS_H - h);
          ctx.fill();
        }
      }

      // ── Layer 4: playback indicator (playhead line + soft band) ──
      if (isPlaying) {
        const currentTime = useAudioStore.getState().currentTime;
        if (currentTime >= region.startTime && currentTime <= region.endTime) {
          const px = ((currentTime - region.startTime) / regionDuration) * CANVAS_W;
          ctx.fillStyle = withAlpha(theme.indicatorColor, 0.15);
          ctx.fillRect(px - 4, 0, 8, CANVAS_H);
          ctx.strokeStyle = theme.indicatorColor;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, CANVAS_H);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function loop() {
      draw();
      if (isPlaying) {
        animRef.current = requestAnimationFrame(loop);
      }
    }
    loop();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [region, rawResults, regionPicks, isPlaying]);

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const chipStyle: React.CSSProperties = {
    fontSize: "var(--fs-caption)",
    lineHeight: "14px",
    padding: "1px var(--space-6)",
    borderRadius: "var(--radius-xs)",
    background: "color-mix(in srgb, var(--bg-active) 80%, transparent)",
  };

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: "var(--bg-active)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: CANVAS_W, height: CANVAS_H, maxWidth: "100%" }} />

      {/* Overlay strip: label + pick count */}
      <div
        style={{
          position: "absolute",
          top: "var(--space-6)",
          left: "var(--space-8)",
          right: "var(--space-8)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <span style={{ ...chipStyle, fontWeight: 600, color: "var(--text-primary)" }}>
          {LABEL_TEXT[region.label]}
        </span>
        <span
          style={{
            ...chipStyle,
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {regionPicks.length}
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 400, marginLeft: "var(--space-4)", color: "var(--text-secondary)" }}>onsets</span>
        </span>
      </div>

      {/* Footer: time range + play button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) var(--space-8)",
          borderTop: "var(--rule) solid var(--separator)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-caption)",
            color: "var(--text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtTime(region.startTime)} – {fmtTime(region.endTime)}
        </span>
        <Button
          size="sm"
          variant={isPlaying ? "secondary" : "ghost"}
          icon={isPlaying ? Square : Play}
          aria-pressed={isPlaying}
          onClick={onPlay}
          style={isPlaying ? { color: "var(--accent-primary)", backgroundColor: "var(--accent-selected)" } : undefined}
        >
          {isPlaying ? "Stop" : "Play"}
        </Button>
      </div>
    </div>
  );
}
