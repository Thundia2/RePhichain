// ============================================================
// Shake Generator Dialog
//
// Generates oscillating moveX / moveY / rotation events for
// screen-shake effects. Follows the same dialog pattern as
// SpinGeneratorDialog (shared Dialog chrome). Includes waveform
// preview and presets.
//
// Recent change: Initial creation for Feature C (Shake Generator).
// ============================================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Activity } from "lucide-react";
import { Field, safeParseNumber } from "../common/FormFields";
import { EasingPicker } from "../common/EasingPicker";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { SegmentedControl } from "../common/SegmentedControl";
import { SELECT_STYLE } from "../common/UIKit";
import { chromeTheme, withAlpha } from "../../canvas/chromeTheme";
import { EVENT_COLORS } from "../../constants/eventColors";
import {
  generateShakeEvents,
  shakeEventCount,
  generateShakePreviewData,
  DEFAULT_SHAKE_CONFIG,
  SHAKE_PRESETS,
} from "../../utils/shakeGenerator";
import type { ShakeConfig } from "../../utils/shakeGenerator";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSelectedLineIndex } from "../../stores/selection";
import type { EasingType } from "../../types/chart";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "var(--space-4)",
};

export function ShakeGeneratorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const selectedLineIndex = useSelectedLineIndex();
  const activeLayer = useEditorStore((s) => s.eventEditorActiveLayer);
  const batchMultiLine = useChartStore((s) => s.batchMultiLineMutations);
  const batchAddToLayer = useChartStore((s) => s.batchAddEventsToLayer);
  const ensureEventLayers = useChartStore((s) => s.ensureEventLayers);

  const [config, setConfig] = useState<ShakeConfig>({ ...DEFAULT_SHAKE_CONFIG });

  // Target: -1 = flat events, 0-4 = event layer index
  // Defaults to the currently active layer in the event editor
  const [targetLayer, setTargetLayer] = useState<number>(
    activeLayer >= 0 ? activeLayer : 1,
  );

  const eventCount = useMemo(() => shakeEventCount(config), [config]);

  const update = useCallback((changes: Partial<ShakeConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleGenerate = useCallback(() => {
    if (selectedLineIndex === null) return;

    const events = generateShakeEvents(config);
    if (events.length === 0) return;

    if (targetLayer < 0) {
      // Flat events — use batchMultiLineMutations with newEvents
      batchMultiLine([{
        lineIndex: selectedLineIndex,
        newEvents: events,
      }]);
    } else {
      // Layer events — ensure layers exist, then batch-add
      ensureEventLayers(selectedLineIndex);
      batchAddToLayer(selectedLineIndex, targetLayer, config.kind, events);
    }

    onClose();
  }, [
    selectedLineIndex, config, targetLayer,
    batchMultiLine, batchAddToLayer, ensureEventLayers, onClose,
  ]);

  if (!open) return null;

  return (
    <Dialog
      title="Shake generator"
      icon={Activity}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={selectedLineIndex === null || eventCount === 0}
          >
            Generate
          </Button>
        </>
      }
    >
      {selectedLineIndex === null && (
        <div style={{ color: "var(--error)", fontSize: "var(--fs-control)", marginBottom: "var(--space-8)" }}>
          Select a line first
        </div>
      )}

      {/* ---- Preset quick-buttons ---- */}
      <div style={{ marginBottom: "var(--space-10)" }}>
        <span style={LABEL_STYLE}>Presets</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
          {SHAKE_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              size="sm"
              onClick={() => update({ ...preset.config })}
              title={preset.description}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        {/* Property and Target Layer */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
          <div>
            <span style={LABEL_STYLE}>Property</span>
            <SegmentedControl
              label="Property"
              tone="accent"
              size="sm"
              value={config.kind}
              onChange={(k) => update({ kind: k })}
              options={[
                { value: "x", label: "X" },
                { value: "y", label: "Y" },
                { value: "rotation", label: "Rotation" },
              ]}
            />
          </div>
          <div>
            <label htmlFor="shake-target-layer" style={LABEL_STYLE}>Target</label>
            <select
              id="shake-target-layer"
              value={targetLayer}
              onChange={(e) => setTargetLayer(parseInt(e.target.value))}
              style={{ ...SELECT_STYLE, width: "100%" }}
            >
              <option value={-1}>Flat events</option>
              {[0, 1, 2, 3, 4].map((i) => (
                <option key={i} value={i}>Layer {i}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Start beat + Duration */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
          <Field label="Start beat" value={config.startBeat} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ startBeat: n });
          }} step="0.25" />
          <Field label="Duration (beats)" value={config.durationBeats} onChange={(v) => {
            const n = safeParseNumber(v);
            if (n !== null) update({ durationBeats: Math.max(0, n) });
          }} step="0.25" />
        </div>

        {/* Amplitude + Frequency */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
          <Field
            label={`Amplitude (${config.kind === "rotation" ? "degrees" : "units"})`}
            value={config.amplitude}
            onChange={(v) => {
              const n = safeParseNumber(v);
              if (n !== null) update({ amplitude: Math.max(0, n) });
            }}
            step={config.kind === "rotation" ? "0.5" : "1"}
          />
          <Field label="Freq (per beat)" value={config.frequency} onChange={(v) => {
            const n = safeParseNumber(v);
            if (n !== null) update({ frequency: Math.max(0.5, Math.min(24, n)) });
          }} step="1" />
        </div>

        {/* Easing (the picker carries its own "Easing" label) */}
        <EasingPicker
          value={typeof config.easing === "string" ? config.easing : "linear"}
          onChange={(easing: string) => update({ easing: easing as EasingType })}
        />

        {/* Decay */}
        <div>
          <span style={LABEL_STYLE}>Decay</span>
          <SegmentedControl
            label="Decay"
            tone="accent"
            size="sm"
            value={config.decay}
            onChange={(d) => update({ decay: d })}
            options={[
              { value: "none", label: "None" },
              { value: "linear", label: "Linear" },
              { value: "exponential", label: "Exponential" },
            ]}
          />
        </div>

        {/* Half-life (only for exponential) */}
        {config.decay === "exponential" && (
          <Field label="Half-life (beats)" value={config.decayHalfLife} onChange={(v) => {
            const n = safeParseNumber(v);
            if (n !== null) update({ decayHalfLife: Math.max(0.25, n) });
          }} step="0.5" />
        )}

        {/* ---- Waveform preview canvas ---- */}
        <ShakeWaveformPreview config={config} />

        {/* Preview info */}
        <div style={{
          fontSize: "var(--fs-caption)", color: "var(--text-secondary)",
        }}>
          Will generate <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{eventCount}</strong> events
          over {config.durationBeats} beats
          {targetLayer >= 0 ? ` on layer ${targetLayer}` : " (flat)"}
        </div>
      </div>
    </Dialog>
  );
}

// ============================================================
// ShakeWaveformPreview — renders a mini oscilloscope of the
// shake waveform. Shows amplitude envelope and oscillation shape.
// ============================================================

function ShakeWaveformPreview({ config }: { config: ShakeConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const previewData = useMemo(
    () => generateShakePreviewData(config, 300),
    [config],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || previewData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const theme = chromeTheme();

    // Clear with the window background
    ctx.fillStyle = theme.bgPrimary;
    ctx.fillRect(0, 0, w, h);

    // Grid: center line
    ctx.strokeStyle = theme.beatLineSecondary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Determine Y scale from max amplitude in the data
    const maxVal = Math.max(
      ...previewData.map((p) => Math.abs(p.value)),
      0.001,
    );
    const yScale = (h / 2 - 4) / maxVal; // 4px padding

    // Waveform colour = the event kind's identity colour (data, not chrome)
    const waveColor = EVENT_COLORS[config.kind];

    // Draw amplitude envelope (faint fill)
    ctx.fillStyle = withAlpha(waveColor, 0.08);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    for (const { t, value } of previewData) {
      ctx.lineTo(t * w, h / 2 - Math.abs(value) * yScale);
    }
    ctx.lineTo(w, h / 2);
    ctx.closePath();
    ctx.fill();

    // Mirror envelope below
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    for (const { t, value } of previewData) {
      ctx.lineTo(t * w, h / 2 + Math.abs(value) * yScale);
    }
    ctx.lineTo(w, h / 2);
    ctx.closePath();
    ctx.fill();

    // Draw waveform line
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    for (const { t, value } of previewData) {
      const px = t * w;
      const py = h / 2 - value * yScale;
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }, [previewData, config]);

  if (previewData.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--space-2)" }}>
      <span style={LABEL_STYLE}>Waveform preview</span>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%", height: 60,
          borderRadius: "var(--radius-lg)",
        }}
      />
      {/* Scale captions sit under the plot so the wave never runs through them */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)", fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
        <span>±{config.amplitude}{config.kind === "rotation" ? "°" : ""}</span>
        <span>{config.durationBeats} beats</span>
      </div>
    </div>
  );
}
