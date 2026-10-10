// ============================================================
// NoteBatchOps — Batch operations for note groups
//
// Shift, Change kind, Flip, Change speed across all notes in
// a group. Extracted from GroupManager.tsx.
// ============================================================

import type { NoteKind } from "../../types/chart";
import type { NoteGroup } from "../../types/group";
import { safeParseNumber } from "../common/FormFields";
import { MoveHorizontal, Shapes, FlipVertical2, Gauge } from "lucide-react";
import { Button } from "../common/Button";
import {
  NOTE_KINDS, CARD_STYLE, INPUT_STYLE, SELECT_STYLE,
} from "./groupManagerStyles";

/** Card title row: sentence-case label over a separator. */
const CARD_TITLE_STYLE: React.CSSProperties = {
  padding: "var(--space-8) var(--space-10)",
  fontSize: "var(--fs-control)",
  fontWeight: 600,
  color: "var(--text-primary)",
  borderBottom: "var(--rule) solid var(--separator)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "var(--space-2)",
};

const NUM_INPUT_STYLE: React.CSSProperties = { ...INPUT_STYLE, width: "100%", fontFamily: "var(--font-mono)" };

export interface NoteBatchOpsProps {
  groupId: string;
  group: NoteGroup;
  shiftDelta: number;
  setShiftDelta: (v: number) => void;
  noteKind: NoteKind;
  setNoteKind: (v: NoteKind) => void;
  noteSpeed: number;
  setNoteSpeed: (v: number) => void;
  onShiftNotes: () => void;
  onChangeKind: () => void;
  onFlipNotes: () => void;
  onChangeSpeed: () => void;
}

export function NoteBatchOps({
  group,
  shiftDelta, setShiftDelta,
  noteKind, setNoteKind,
  noteSpeed, setNoteSpeed,
  onShiftNotes, onChangeKind, onFlipNotes, onChangeSpeed,
}: NoteBatchOpsProps) {
  const noteCount = group.notes.length;
  const disabled = noteCount === 0;

  return (
    <>
      {/* Shift beats */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Shift beats
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)" }}>
          <label style={LABEL_STYLE}>Delta (beats)</label>
          <input type="number" step="0.25" value={shiftDelta} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setShiftDelta(n); }} style={{ ...NUM_INPUT_STYLE, marginBottom: "var(--space-6)" }} />
          <Button variant="primary" block icon={MoveHorizontal} onClick={onShiftNotes} disabled={disabled}>
            Shift {noteCount} notes
          </Button>
        </div>
      </div>

      {/* Change kind */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Change kind
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)" }}>
          <select value={noteKind} onChange={(e) => setNoteKind(e.target.value as NoteKind)} style={{ ...SELECT_STYLE, width: "100%", marginBottom: "var(--space-6)" }}>
            {NOTE_KINDS.map((nk) => <option key={nk.value} value={nk.value}>{nk.label}</option>)}
          </select>
          <Button variant="primary" block icon={Shapes} onClick={onChangeKind} disabled={disabled}>
            Set kind on {noteCount} notes
          </Button>
        </div>
      </div>

      {/* Quick actions */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Quick actions
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Button block icon={FlipVertical2} onClick={onFlipNotes} disabled={disabled}>
            Flip above/below ({noteCount} notes)
          </Button>
          <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Speed</label>
              <input type="number" step="0.1" value={noteSpeed} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setNoteSpeed(n); }} style={NUM_INPUT_STYLE} />
            </div>
            <Button icon={Gauge} onClick={onChangeSpeed} disabled={disabled}>
              Set speed
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
