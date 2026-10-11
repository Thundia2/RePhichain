// ============================================================
// LineMode — Note Generator Sub-tab
//
// Inline note pattern generator for batch-creating notes on
// the selected line. Supports linear, sine, zigzag, staircase,
// arc, random, and custom f(t) shapes. Extracted from
// LineMode.tsx for size management.
// ============================================================

import type React from "react";
import { useState, useMemo } from "react";
import { SquareDashed } from "lucide-react";
import { useSelectedLineIndex } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { generateNotePattern, validateExpression } from "../../../utils/notePatternGenerator";
import type { NotePatternConfig, PatternShape } from "../../../types/notePattern";
import type { NoteKind } from "../../../types/chart";
import { NumericInput } from "../../common/FormFields";
import { SectionHeader } from "../shared/SectionHeader";
import { ContextBadge } from "../shared/ContextBadge";
import { Button } from "../../common/Button";
import { NoteGlyph } from "../../common/NoteGlyph";
import { SegmentedControl } from "../../common/SegmentedControl";
import { Pill, INPUT_STYLE } from "../../common/UIKit";

// ---- Constants ----

const NOTE_GEN_SHAPES: { value: PatternShape; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "sine", label: "Sine" },
  { value: "cosine", label: "Cosine" },
  { value: "zigzag", label: "Zigzag" },
  { value: "staircase", label: "Staircase" },
  { value: "arc", label: "Arc" },
  { value: "random", label: "Random" },
  { value: "custom", label: "f(t)" },
];

const NOTE_GEN_KINDS: { value: NoteKind; label: string }[] = [
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

const FIELD_LABEL: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "var(--space-2)",
  fontSize: "var(--fs-caption)", color: "var(--text-secondary)",
};

const FIELD_INPUT: React.CSSProperties = { ...INPUT_STYLE, width: "100%", minWidth: 0, fontFamily: "var(--font-mono)" };

// ---- Note Gen Tab ----

export function NoteGenTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const batchAddNotes = useChartStore((s) => s.batchAddNotes);

  const [config, setConfig] = useState<NotePatternConfig>({
    startBeat: 0, endBeat: 8, noteCount: 16,
    noteKind: "drag", above: true, shape: "linear",
    startX: -300, endX: 300, cycles: 2, amplitude: 300,
    stairWidth: 4, arcHeight: 200, speed: 1, fake: false, holdDuration: 1,
    expression: "300*sin(2*pi*t)",
  });

  const update = (changes: Partial<NotePatternConfig>) =>
    setConfig((prev) => ({ ...prev, ...changes }));

  const previewNotes = useMemo(() => generateNotePattern(config), [config]);

  const handleGenerate = () => {
    if (selectedLineIndex === null) return;
    const notes = generateNotePattern(config);
    batchAddNotes(selectedLineIndex, notes);
  };

  const showCycles = config.shape === "sine" || config.shape === "cosine" || config.shape === "zigzag";
  const showStairWidth = config.shape === "staircase";
  const showArcHeight = config.shape === "arc";
  const showExpression = config.shape === "custom";

  const expressionError = useMemo(
    () => showExpression && config.expression ? validateExpression(config.expression) : null,
    [showExpression, config.expression],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <ContextBadge
        icon={SquareDashed}
        label="Note pattern generator"
        detail={`${previewNotes.length} notes`}
        variant="line"
      />

      {/* Shape selector */}
      <SectionHeader label="Shape" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", padding: "0 var(--space-4)" }}>
        {NOTE_GEN_SHAPES.map((s) => (
          <Pill key={s.value} active={config.shape === s.value} onClick={() => update({ shape: s.value })}>
            {s.label}
          </Pill>
        ))}
      </div>

      {/* Timing */}
      <SectionHeader label="Timing" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
        <label style={FIELD_LABEL}>
          Start beat
          <NumericInput value={config.startBeat} onChange={(v) => update({ startBeat: v })} step={0.25} style={FIELD_INPUT} />
        </label>
        <label style={FIELD_LABEL}>
          End beat
          <NumericInput value={config.endBeat} onChange={(v) => update({ endBeat: v })} step={0.25} style={FIELD_INPUT} />
        </label>
        <label style={FIELD_LABEL}>
          Count
          <NumericInput value={config.noteCount} onChange={(v) => update({ noteCount: Math.max(1, Math.round(v)) })} step={1} min={1} style={FIELD_INPUT} />
        </label>
      </div>

      {/* X range */}
      <SectionHeader label="X range" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
        <label style={FIELD_LABEL}>
          Start X
          <NumericInput value={config.startX} onChange={(v) => update({ startX: v })} step={10} style={FIELD_INPUT} />
        </label>
        <label style={FIELD_LABEL}>
          End X
          <NumericInput value={config.endX} onChange={(v) => update({ endX: v })} step={10} style={FIELD_INPUT} />
        </label>
      </div>

      {/* Shape-specific params */}
      {showCycles && (
        <>
          <SectionHeader label="Wave parameters" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
            <label style={FIELD_LABEL}>
              Cycles
              <NumericInput value={config.cycles ?? 2} onChange={(v) => update({ cycles: v })} step={0.5} min={0.5} style={FIELD_INPUT} />
            </label>
            <label style={FIELD_LABEL}>
              Amplitude
              <NumericInput value={config.amplitude ?? 300} onChange={(v) => update({ amplitude: v })} step={10} style={FIELD_INPUT} />
            </label>
          </div>
        </>
      )}
      {showStairWidth && (
        <div style={{ padding: "0 var(--space-4)" }}>
          <label style={FIELD_LABEL}>
            Stair width
            <NumericInput value={config.stairWidth ?? 4} onChange={(v) => update({ stairWidth: Math.max(1, Math.round(v)) })} step={1} min={1} style={FIELD_INPUT} />
          </label>
        </div>
      )}
      {showArcHeight && (
        <div style={{ padding: "0 var(--space-4)" }}>
          <label style={FIELD_LABEL}>
            Arc height
            <NumericInput value={config.arcHeight ?? 200} onChange={(v) => update({ arcHeight: v })} step={10} style={FIELD_INPUT} />
          </label>
        </div>
      )}
      {showExpression && (
        <>
          <SectionHeader label="Custom expression" />
          <div style={{ padding: "0 var(--space-4)" }}>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
              X = f(t), where t goes from 0 to 1. Available: sin, cos, tan, abs, sqrt, pow, pi, e, min, max, floor, ceil, round
            </div>
            <input
              type="text"
              aria-label="Custom expression"
              aria-invalid={expressionError ? true : undefined}
              value={config.expression ?? ""}
              onChange={(e) => update({ expression: e.target.value })}
              placeholder="300*sin(2*pi*t)"
              spellCheck={false}
              style={{
                ...INPUT_STYLE,
                width: "100%",
                height: "var(--control-lg)",
                fontFamily: "var(--font-mono)",
                border: `var(--rule) solid ${expressionError ? "var(--error)" : config.expression ? "var(--success)" : "var(--border-color)"}`,
                transition: "border-color var(--dur-fast)",
              }}
            />
            {expressionError && (
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--error)", marginTop: "var(--space-2)", fontFamily: "var(--font-mono)" }}>
                {expressionError}
              </div>
            )}
            {!expressionError && config.expression && (
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--success)", marginTop: "var(--space-2)" }}>
                Valid expression
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
              {[
                "300*sin(2*pi*t)",
                "675*(2*t-1)",
                "400*cos(4*pi*t)*t",
                "300*sin(pi*t)^2",
                "675*sin(t*pi)*(1-t)",
              ].map((ex) => (
                <Pill key={ex} active={config.expression === ex} onClick={() => update({ expression: ex })}>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{ex}</span>
                </Pill>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Note kind */}
      <SectionHeader label="Note kind" />
      <div style={{ padding: "0 var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SegmentedControl
          label="Note kind"
          block
          options={NOTE_GEN_KINDS.map((k) => ({
            value: k.value,
            label: <><NoteGlyph kind={k.value} size={12} />{k.label}</>,
          }))}
          value={config.noteKind}
          onChange={(v) => update({ noteKind: v })}
        />

        {/* Above/Below */}
        <SegmentedControl
          label="Note side"
          tone="accent"
          block
          options={[{ value: "above", label: "Above" }, { value: "below", label: "Below" }]}
          value={config.above ? "above" : "below"}
          onChange={(v) => update({ above: v === "above" })}
        />
      </div>

      {/* Generate */}
      <div style={{ padding: "var(--space-4) var(--space-4) 0" }}>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={handleGenerate}
          disabled={selectedLineIndex === null || previewNotes.length === 0}
        >
          Generate {previewNotes.length} notes
        </Button>
      </div>
    </div>
  );
}
