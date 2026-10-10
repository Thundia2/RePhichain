// ============================================================
// Batch Note Operations
//
// Reusable component for multi-note editing operations:
// Distribute X, Offset X, Set all kind, Flip all.
// Used by UnifiedInspector and FloatingInspector.
// ============================================================

import { useState, useCallback } from "react";
import { AlignHorizontalSpaceAround, Minus, Plus, FlipVertical2 } from "lucide-react";
import { Button } from "./Button";
import { Field, SelectField, safeParseNumber } from "./FormFields";
import { useChartStore } from "../../stores/chartStore";
import { useSelectedLineIndex, useSelectedNoteIndices } from "../../stores/selection";
import { distributeX, offsetX } from "../../utils/batchNoteOps";
import type { NoteKind } from "../../types/chart";

const NOTE_KIND_OPTIONS = [
  { value: "", label: "Set all" },
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

export function BatchNoteOps() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const batchEditNotes = useChartStore((s) => s.batchEditNotes);
  const editNotes = useChartStore((s) => s.editNotes);
  const lines = useChartStore((s) => s.chart.lines);

  const [distStartX, setDistStartX] = useState(-300);
  const [distEndX, setDistEndX] = useState(300);
  const [offsetDelta, setOffsetDelta] = useState(50);

  const line = selectedLineIndex !== null ? lines[selectedLineIndex] : null;
  const noteCount = selectedNoteIndices.length;

  const handleDistributeX = useCallback(() => {
    if (!line || selectedLineIndex === null || noteCount < 2) return;
    const edits = distributeX(line.notes, selectedNoteIndices, distStartX, distEndX);
    batchEditNotes(selectedLineIndex, edits);
  }, [line, selectedLineIndex, selectedNoteIndices, distStartX, distEndX, noteCount, batchEditNotes]);

  const handleOffsetX = useCallback((delta: number) => {
    if (!line || selectedLineIndex === null) return;
    const edits = offsetX(line.notes, selectedNoteIndices, delta);
    batchEditNotes(selectedLineIndex, edits);
  }, [line, selectedLineIndex, selectedNoteIndices, batchEditNotes]);

  const handleSetKind = useCallback((kind: string) => {
    if (!kind || selectedLineIndex === null) return;
    editNotes(selectedLineIndex, selectedNoteIndices, { kind: kind as NoteKind });
  }, [selectedLineIndex, selectedNoteIndices, editNotes]);

  const handleFlipAll = useCallback(() => {
    if (!line || selectedLineIndex === null) return;
    const allAbove = selectedNoteIndices.every((i) => line.notes[i]?.above);
    editNotes(selectedLineIndex, selectedNoteIndices, { above: !allAbove });
  }, [line, selectedLineIndex, selectedNoteIndices, editNotes]);

  if (noteCount < 2) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <div style={{
        fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)",
        borderBottom: "var(--rule) solid var(--separator)", paddingBottom: "var(--space-4)",
      }}>
        Batch ({noteCount} notes)
      </div>

      {/* Distribute X */}
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end" }}>
        <Field label="From X" value={distStartX} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) setDistStartX(n);
        }} />
        <Field label="To X" value={distEndX} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) setDistEndX(n);
        }} />
        <Button variant="primary" size="sm" icon={AlignHorizontalSpaceAround} onClick={handleDistributeX} disabled={noteCount < 2}>
          Distribute
        </Button>
      </div>

      {/* Offset X */}
      <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end" }}>
        <Field label="Offset" value={offsetDelta} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) setOffsetDelta(n);
        }} />
        <Button size="sm" icon={Minus} onClick={() => handleOffsetX(-offsetDelta)} title="Shift X by minus the offset" aria-label="Offset X negative">
          X
        </Button>
        <Button size="sm" icon={Plus} onClick={() => handleOffsetX(offsetDelta)} title="Shift X by the offset" aria-label="Offset X positive">
          X
        </Button>
      </div>

      {/* Set kind / Flip */}
      <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "flex-end" }}>
        <SelectField label="Kind" value="" options={NOTE_KIND_OPTIONS} onChange={handleSetKind} />
        <Button size="sm" icon={FlipVertical2} onClick={handleFlipAll} title="Flip above/below">
          Flip
        </Button>
      </div>
    </div>
  );
}
