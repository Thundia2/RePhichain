// ============================================================
// LineBatchOps — Batch operations for line groups
//
// Add event, Copy events, Delete events across all lines in
// a group. Extracted from GroupManager.tsx.
// ============================================================

import type { LineEventKind, PhichainChart, Line } from "../../types/chart";
import type { LineGroup } from "../../types/group";
import { safeParseNumber } from "../common/FormFields";
import { Plus, Copy, Trash2 } from "lucide-react";
import { Button } from "../common/Button";
import {
  EVENT_KINDS, CARD_STYLE, INPUT_STYLE, SELECT_STYLE,
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

export interface LineBatchOpsProps {
  groupId: string;
  group: LineGroup;
  chart: PhichainChart;
  batchKind: LineEventKind;
  setBatchKind: (v: LineEventKind) => void;
  batchType: "constant" | "transition";
  setBatchType: (v: "constant" | "transition") => void;
  batchValue: number;
  setBatchValue: (v: number) => void;
  batchEndValue: number;
  setBatchEndValue: (v: number) => void;
  batchStartBeat: number;
  setBatchStartBeat: (v: number) => void;
  batchEndBeat: number;
  setBatchEndBeat: (v: number) => void;
  copySourceLine: number;
  setCopySourceLine: (v: number) => void;
  deleteKind: LineEventKind;
  setDeleteKind: (v: LineEventKind) => void;
  onAddEvent: () => void;
  onCopyEvents: () => void;
  onDeleteEvents: () => void;
}

export function LineBatchOps({
  group, chart,
  batchKind, setBatchKind,
  batchType, setBatchType,
  batchValue, setBatchValue,
  batchEndValue, setBatchEndValue,
  batchStartBeat, setBatchStartBeat,
  batchEndBeat, setBatchEndBeat,
  copySourceLine, setCopySourceLine,
  deleteKind, setDeleteKind,
  onAddEvent, onCopyEvents, onDeleteEvents,
}: LineBatchOpsProps) {
  const lineCount = group.lines.length;

  return (
    <>
      {/* Add Event */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Add event
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          <div>
            <label style={LABEL_STYLE}>Kind</label>
            <select value={batchKind} onChange={(e) => setBatchKind(e.target.value as LineEventKind)} style={{ ...SELECT_STYLE, width: "100%" }}>
              {EVENT_KINDS.map((ek) => <option key={ek.value} value={ek.value}>{ek.label}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Type</label>
            <select value={batchType} onChange={(e) => setBatchType(e.target.value as "constant" | "transition")} style={{ ...SELECT_STYLE, width: "100%" }}>
              <option value="constant">Constant</option>
              <option value="transition">Transition</option>
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Start beat</label>
            <input type="number" step="0.25" value={batchStartBeat} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setBatchStartBeat(n); }} style={NUM_INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>End beat</label>
            <input type="number" step="0.25" value={batchEndBeat} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setBatchEndBeat(n); }} style={NUM_INPUT_STYLE} />
          </div>
          <div>
            <label style={LABEL_STYLE}>{batchType === "constant" ? "Value" : "Start value"}</label>
            <input type="number" step="0.1" value={batchValue} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setBatchValue(n); }} style={NUM_INPUT_STYLE} />
          </div>
          {batchType === "transition" && (
            <div>
              <label style={LABEL_STYLE}>End value</label>
              <input type="number" step="0.1" value={batchEndValue} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setBatchEndValue(n); }} style={NUM_INPUT_STYLE} />
            </div>
          )}
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)" }}>
          <Button variant="primary" block icon={Plus} onClick={onAddEvent} disabled={lineCount === 0}>
            Add to {lineCount} lines
          </Button>
        </div>
      </div>

      {/* Copy Events */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Copy events
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          <div>
            <label style={LABEL_STYLE}>Source line</label>
            <select value={copySourceLine} onChange={(e) => setCopySourceLine(parseInt(e.target.value))} style={{ ...SELECT_STYLE, width: "100%" }}>
              {chart.lines.map((_: Line, i: number) => <option key={i} value={i}>Line {i + 1}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Event kind</label>
            <select value={batchKind} onChange={(e) => setBatchKind(e.target.value as LineEventKind)} style={{ ...SELECT_STYLE, width: "100%" }}>
              {EVENT_KINDS.map((ek) => <option key={ek.value} value={ek.value}>{ek.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)" }}>
          <Button variant="primary" block icon={Copy} onClick={onCopyEvents} disabled={lineCount === 0}>
            Copy to {lineCount} lines
          </Button>
        </div>
      </div>

      {/* Delete Events */}
      <div style={CARD_STYLE}>
        <div style={CARD_TITLE_STYLE}>
          Delete events
        </div>
        <div style={{ padding: "var(--space-6) var(--space-10)" }}>
          <label style={LABEL_STYLE}>Event kind</label>
          <select value={deleteKind} onChange={(e) => setDeleteKind(e.target.value as LineEventKind)} style={{ ...SELECT_STYLE, width: "100%", marginBottom: "var(--space-6)" }}>
            {EVENT_KINDS.map((ek) => <option key={ek.value} value={ek.value}>{ek.label}</option>)}
          </select>
          <Button variant="danger" block icon={Trash2} onClick={onDeleteEvents} disabled={lineCount === 0}>
            Delete {EVENT_KINDS.find((ek) => ek.value === deleteKind)?.label ?? deleteKind} from {lineCount} lines
          </Button>
        </div>
      </div>
    </>
  );
}
