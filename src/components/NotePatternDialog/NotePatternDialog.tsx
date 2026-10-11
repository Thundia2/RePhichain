// ============================================================
// Note Pattern Dialog
//
// Modal dialog for generating note patterns with a preview.
// Alternative to the canvas-native pattern tool for users who
// prefer typing exact numbers. Rendered in the shared Dialog chrome.
// ============================================================

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { AudioWaveform } from "lucide-react";
import { Field, SelectField } from "../common/FormFields";
import { safeParseNumber } from "../common/FormFields";
import { generateNotePattern } from "../../utils/notePatternGenerator";
import { useChartStore } from "../../stores/chartStore";
import { useSelectedLineIndex } from "../../stores/selection";
import type { NotePatternConfig, PatternShape } from "../../types/notePattern";
import type { NoteKind } from "../../types/chart";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { SegmentedControl } from "../common/SegmentedControl";
import { chromeTheme } from "../../canvas/chromeTheme";
import { ABOVE_NOTE_COLORS } from "../../constants/canvasConstants";

const SHAPE_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "sine", label: "Sine wave" },
  { value: "cosine", label: "Cosine wave" },
  { value: "zigzag", label: "Zigzag" },
  { value: "staircase", label: "Staircase" },
  { value: "arc", label: "Arc (bezier)" },
  { value: "random", label: "Random" },
];

const KIND_OPTIONS = [
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

function PatternPreview({ config }: { config: NotePatternConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewNotes = useMemo(() => generateNotePattern(config), [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const t = chromeTheme();
    ctx.fillStyle = t.bgPrimary;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = t.borderColor;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);
    if (previewNotes.length === 0) return;

    const beatRange = (config.endBeat - config.startBeat) || 1;
    // Note identity colour for the chosen kind (data, not chrome).
    ctx.fillStyle = ABOVE_NOTE_COLORS[config.noteKind] ?? t.noteTap;

    for (const note of previewNotes) {
      const nx = ((note.x + 675) / 1350) * W;
      const beatFloat = note.beat[0] + note.beat[1] / note.beat[2];
      const ny = ((beatFloat - config.startBeat) / beatRange) * H;
      ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI * 2); ctx.fill();
    }
  }, [previewNotes, config]);

  return <canvas ref={canvasRef} width={280} height={140}
    style={{ display: "block", width: "100%", height: 140, borderRadius: "var(--radius-lg)" }} />;
}

export function NotePatternDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedLineIndex = useSelectedLineIndex();
  const batchAddNotes = useChartStore((s) => s.batchAddNotes);

  const [config, setConfig] = useState<NotePatternConfig>({
    startBeat: 0,
    endBeat: 8,
    noteCount: 16,
    noteKind: "drag",
    above: true,
    shape: "linear",
    startX: -300,
    endX: 300,
    cycles: 2,
    amplitude: 300,
    stairWidth: 4,
    arcHeight: 200,
    speed: 1,
    fake: false,
    holdDuration: 1,
  });

  const update = useCallback((changes: Partial<NotePatternConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleGenerate = useCallback(() => {
    if (selectedLineIndex === null) return;
    const notes = generateNotePattern(config);
    batchAddNotes(selectedLineIndex, notes);
    onClose();
  }, [selectedLineIndex, config, batchAddNotes, onClose]);

  if (!open) return null;

  const showCycles = config.shape === "sine" || config.shape === "cosine" || config.shape === "zigzag";
  const showStairWidth = config.shape === "staircase";
  const showArcHeight = config.shape === "arc";

  return (
    <Dialog
      title="Note pattern"
      icon={AudioWaveform}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGenerate} disabled={selectedLineIndex === null}>
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

      {/* Timing */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
        <Field label="Start beat" value={config.startBeat} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ startBeat: n });
        }} step="0.25" />
        <Field label="End beat" value={config.endBeat} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ endBeat: n });
        }} step="0.25" />
        <Field label="Count" value={config.noteCount} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ noteCount: Math.max(1, Math.round(n)) });
        }} />
        <SelectField label="Type" value={config.noteKind} options={KIND_OPTIONS}
          onChange={(v) => update({ noteKind: v as NoteKind })} />
      </div>

      {/* Side */}
      <div style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-12)", alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", width: 64, textAlign: "right", flexShrink: 0 }}>Side</span>
        <SegmentedControl
          label="Side"
          tone="accent"
          size="sm"
          value={config.above ? "above" : "below"}
          onChange={(v) => update({ above: v === "above" })}
          options={[
            { value: "above", label: "Above" },
            { value: "below", label: "Below" },
          ]}
        />
      </div>

      {/* Shape */}
      <SelectField label="Pattern" value={config.shape} options={SHAPE_OPTIONS}
        onChange={(v) => update({ shape: v as PatternShape })} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)", marginTop: "var(--space-8)", marginBottom: "var(--space-12)" }}>
        <Field label="Start X" value={config.startX} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ startX: n });
        }} />
        <Field label="End X" value={config.endX} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ endX: n });
        }} />
        {showCycles && (
          <Field label="Cycles" value={config.cycles ?? 2} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ cycles: n });
          }} step="0.5" />
        )}
        {(config.shape === "sine" || config.shape === "cosine") && (
          <Field label="Amplitude" value={config.amplitude ?? 300} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ amplitude: n });
          }} />
        )}
        {showStairWidth && (
          <Field label="Step width" value={config.stairWidth ?? 4} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ stairWidth: Math.max(1, Math.round(n)) });
          }} />
        )}
        {showArcHeight && (
          <Field label="Arc height" value={config.arcHeight ?? 200} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ arcHeight: n });
          }} />
        )}
      </div>

      {/* Preview */}
      <PatternPreview config={config} />

      {/* Options */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)", marginTop: "var(--space-12)" }}>
        <Field label="Speed" value={config.speed ?? 1} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ speed: n });
        }} step="0.1" />
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", fontSize: "var(--fs-control)", color: "var(--text-secondary)", cursor: "pointer" }}>
          <input type="checkbox" checked={config.fake ?? false}
            onChange={(e) => update({ fake: e.target.checked })} />
          Fake notes
        </label>
      </div>
    </Dialog>
  );
}
