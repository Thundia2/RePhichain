// ============================================================
// StepRecordBanner — persistent banner in the ContextPanel
// that appears when step recording is active.
//
// Shows status, step size presets, note kind selector, and exit.
// Renders above the mode content in all ContextPanel modes.
//
// Filled bg-active banner using the single accent; note kinds show
// their NoteGlyph. Initial creation for Section D (ContextPanel).
// ============================================================

import type React from "react";
import { Minus, Plus, X } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import type { NoteKind } from "../../types/chart";
import { IconButton } from "../common/IconButton";
import { NoteGlyph } from "../common/NoteGlyph";
import { SegmentedControl } from "../common/SegmentedControl";
import { Button } from "../common/Button";
import { ActionKbd, Kbd } from "../common/Kbd";
import { Pill } from "../common/UIKit";
import { STEP_PRESETS, formatStepSize } from "../../utils/stepPresets";
import { snapBeat, formatBeat } from "../../utils/beat";

const NOTE_KINDS: Array<{ value: NoteKind; label: string }> = [
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

const HINT_ROW: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "var(--space-6)",
  fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-4)",
};

export function StepRecordBanner() {
  const active = useEditorStore((s) => s.stepRecordActive);
  const currentBeat = useEditorStore((s) => s.stepRecordCurrentBeat);
  const noteKind = useEditorStore((s) => s.stepRecordNoteKind);
  const stepSize = useEditorStore((s) => s.stepRecordStepSize);
  const notesPlaced = useEditorStore((s) => s.stepRecordNotesPlaced);
  const density = useEditorStore((s) => s.density);
  const setStepSize = useEditorStore((s) => s.setStepRecordStepSize);
  const setNoteKind = useEditorStore((s) => s.setStepRecordNoteKind);
  const exitStepRecord = useEditorStore((s) => s.exitStepRecord);
  const halveStepSize = useEditorStore((s) => s.halveStepSize);
  const doubleStepSize = useEditorStore((s) => s.doubleStepSize);

  if (!active) return null;

  const beatLabel = formatBeat(snapBeat(currentBeat, density));
  const stepLabel = formatStepSize(stepSize);

  return (
    <div style={{
      margin: "0 0 var(--space-6) 0",
      padding: "var(--space-8) var(--space-10)",
      background: "var(--bg-active)",
      borderRadius: "var(--radius-lg)",
      display: "flex", flexDirection: "column", gap: "var(--space-8)",
    }}>
      {/* Scoped pulse animation */}
      <style>{`@keyframes stepPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* ---- Status line ---- */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-6)",
        fontSize: "var(--fs-caption)",
      }}>
        {/* Pulsing dot */}
        <span style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: "var(--accent-primary)",
          animation: "stepPulse 1.2s ease-in-out infinite",
        }} />
        <span style={{ color: "var(--accent-primary)", fontWeight: 600, fontSize: "var(--fs-control)" }}>Step record</span>
        <NoteGlyph kind={noteKind} size={12} />
        <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          {stepLabel} · Beat {beatLabel}
        </span>
        <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
          {notesPlaced} placed
        </span>
      </div>

      {/* ---- Step size presets ---- */}
      <div>
        <div style={HINT_ROW}>
          Step size <Kbd>Shift+Up/Down</Kbd>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
          {/* Halve step size button */}
          <IconButton
            icon={Minus}
            label="Halve step size"
            shortcut="Shift+Down"
            size="sm"
            onClick={halveStepSize}
            disabled={stepSize <= 1 / 32}
          />
          {STEP_PRESETS.map((p) => {
            const isActive = Math.abs(stepSize - p.value) < 0.0001;
            return (
              <Pill key={p.label} active={isActive} onClick={() => setStepSize(p.value)}>
                <span style={{ fontFamily: "var(--font-mono)" }}>{p.label}</span>
              </Pill>
            );
          })}
          {/* Double step size button */}
          <IconButton
            icon={Plus}
            label="Double step size"
            shortcut="Shift+Up"
            size="sm"
            onClick={doubleStepSize}
            disabled={stepSize >= 4}
          />
        </div>
      </div>

      {/* ---- Note kind selector ---- */}
      <div>
        <div style={HINT_ROW}>
          Note kind <ActionKbd action="place_tap" /> <ActionKbd action="place_drag" />{" "}
          <ActionKbd action="place_flick" /> <ActionKbd action="place_hold" />
        </div>
        <SegmentedControl
          label="Step record note kind"
          size="sm"
          block
          options={NOTE_KINDS.map((k) => ({
            value: k.value,
            label: <><NoteGlyph kind={k.value} size={12} />{k.label}</>,
          }))}
          value={noteKind}
          onChange={(k) => setNoteKind(k)}
        />
      </div>

      {/* ---- Exit button ---- */}
      <Button size="sm" icon={X} block onClick={exitStepRecord}>
        Exit step record (S / Esc)
      </Button>
    </div>
  );
}
