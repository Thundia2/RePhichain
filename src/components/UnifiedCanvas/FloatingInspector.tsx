// ============================================================
// Floating Mini-Inspector
//
// Compact property popover that appears near the selection point
// on the canvas. Shows the most relevant fields for quick editing
// without opening the full sidebar inspector.
//
// Dismissal: Escape, click outside, tool change, playback start.
// Styled as a ui-popover; note type and side use SegmentedControls.
// ============================================================

import type React from "react";
import { useEffect, useRef } from "react";
import { ArrowUpDown } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import {
  useSelectedLineIndex,
  useSelectedNoteIndices,
  useSelectedEventIndices,
} from "../../stores/selection";
import { useChartStore } from "../../stores/chartStore";
import { useAudioStore } from "../../stores/audioStore";
import { Field, safeParseNumber } from "../common/FormFields";
import { NoteGlyph } from "../common/NoteGlyph";
import { SegmentedControl, type SegmentOption } from "../common/SegmentedControl";
import { Button } from "../common/Button";
import type { NoteKind, Line } from "../../types/chart";

const NOTE_KIND_LABELS: Record<NoteKind, string> = { tap: "Tap", drag: "Drag", flick: "Flick", hold: "Hold" };

const NOTE_KIND_SEGMENTS: SegmentOption<NoteKind>[] = (["tap", "drag", "flick", "hold"] as const).map((k) => ({
  value: k,
  title: NOTE_KIND_LABELS[k],
  label: <><NoteGlyph kind={k} size={14} /><span className="sr-only">{NOTE_KIND_LABELS[k]}</span></>,
}));

const SIDE_SEGMENTS: SegmentOption<"above" | "below">[] = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
];

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-2)",
};

/** "scale_x" → "Scale X", "x" → "X" (sentence case, axis letters upper-case). */
function eventKindLabel(kind: string): string {
  return kind
    .split("_")
    .map((w, i) => (w.length === 1 ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Label + control row laid out like the shared Field / SelectField. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function FloatingInspector() {
  const inspector = useEditorStore((s) => s.floatingInspector);
  const hide = useEditorStore((s) => s.hideFloatingInspector);
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const selectedEventIndices = useSelectedEventIndices();
  const editNote = useChartStore((s) => s.editNote);
  const editNotes = useChartStore((s) => s.editNotes);
  const editEvent = useChartStore((s) => s.editEvent);
  const lines = useChartStore((s) => s.chart.lines);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on Escape
  useEffect(() => {
    if (!inspector) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [inspector, hide]);

  // Dismiss on click outside
  useEffect(() => {
    if (!inspector) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        hide();
      }
    };
    // Delay to avoid dismissing from the click that opened it
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleClick);
    };
  }, [inspector, hide]);

  // Dismiss on playback start
  useEffect(() => {
    if (isPlaying) hide();
  }, [isPlaying, hide]);

  if (!inspector || selectedLineIndex === null) return null;

  const line = lines[selectedLineIndex];
  if (!line) return null;

  // Clamp position to screen bounds
  const x = Math.min(inspector.screenX, window.innerWidth - 220);
  const y = Math.min(inspector.screenY, window.innerHeight - 200);

  return (
    <div
      ref={ref}
      className="ui-popover"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: "var(--z-toast)",
        padding: "var(--space-10)",
        minWidth: 200,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {inspector.targetType === "note" && (
        <SingleNoteInspector
          line={line}
          lineIndex={selectedLineIndex}
          noteIndex={selectedNoteIndices[0]}
          editNote={editNote}
        />
      )}
      {inspector.targetType === "multi_note" && (
        <MultiNoteInspector
          noteCount={selectedNoteIndices.length}
          lineIndex={selectedLineIndex}
          noteIndices={selectedNoteIndices}
          editNotes={editNotes}
          line={line}
        />
      )}
      {inspector.targetType === "event" && (
        <SingleEventInspector
          line={line}
          lineIndex={selectedLineIndex}
          eventIndex={selectedEventIndices[0]}
          editEvent={editEvent}
        />
      )}
      {inspector.targetType === "multi_event" && (
        <div style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          {selectedEventIndices.length} events selected
        </div>
      )}
    </div>
  );
}

function SingleNoteInspector({
  line,
  lineIndex,
  noteIndex,
  editNote,
}: {
  line: Line;
  lineIndex: number;
  noteIndex: number;
  editNote: (lineIndex: number, noteIndex: number, changes: Record<string, unknown>) => void;
}) {
  const note = line.notes[noteIndex];
  if (!note) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={TITLE_STYLE}>
        Note #{noteIndex}
      </div>
      <FieldRow label="Kind">
        <SegmentedControl
          options={NOTE_KIND_SEGMENTS}
          value={note.kind}
          size="sm"
          block
          label="Note type"
          onChange={(v) => {
            const changes: Record<string, unknown> = { kind: v };
            if (v === "hold" && !note.hold_beat) {
              changes.hold_beat = [1, 0, 1];
            }
            editNote(lineIndex, noteIndex, changes);
          }}
        />
      </FieldRow>
      <Field
        label="X"
        value={note.x}
        onChange={(v) => {
          const n = safeParseNumber(v);
          if (n !== null) editNote(lineIndex, noteIndex, { x: Math.round(n) });
        }}
      />
      <FieldRow label="Side">
        <SegmentedControl
          options={SIDE_SEGMENTS}
          value={note.above ? "above" : "below"}
          size="sm"
          block
          label="Side"
          onChange={(v) => editNote(lineIndex, noteIndex, { above: v === "above" })}
        />
      </FieldRow>
    </div>
  );
}

function MultiNoteInspector({
  noteCount,
  lineIndex,
  noteIndices,
  editNotes,
  line,
}: {
  noteCount: number;
  lineIndex: number;
  noteIndices: number[];
  editNotes: (lineIndex: number, noteIndices: number[], changes: Record<string, unknown>) => void;
  line: Line;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={TITLE_STYLE}>
        {noteCount} notes selected
      </div>
      {/* Mixed selection: no segment is pre-selected; picking one sets all */}
      <FieldRow label="Set kind">
        <SegmentedControl
          options={NOTE_KIND_SEGMENTS}
          value={null}
          size="sm"
          block
          label="Set note type for all"
          onChange={(v) => editNotes(lineIndex, noteIndices, { kind: v })}
        />
      </FieldRow>
      <Button
        size="sm"
        icon={ArrowUpDown}
        onClick={() => {
          const allAbove = noteIndices.every((i) => line.notes[i]?.above);
          editNotes(lineIndex, noteIndices, { above: !allAbove });
        }}
      >
        Flip all above/below
      </Button>
    </div>
  );
}

function SingleEventInspector({
  line,
  lineIndex,
  eventIndex,
  editEvent,
}: {
  line: Line;
  lineIndex: number;
  eventIndex: number;
  editEvent: (lineIndex: number, eventIndex: number, changes: Record<string, unknown>) => void;
}) {
  const event = line.events[eventIndex];
  if (!event) return null;

  // Extract typed transition/constant values for type-safe JSX access
  const transValue = event.value && "transition" in event.value ? event.value.transition : null;
  const constValue = event.value && "constant" in event.value ? event.value.constant : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={TITLE_STYLE}>
        {eventKindLabel(event.kind)} event
      </div>
      {transValue ? (
        <>
          <Field
            label="Start"
            value={transValue.start}
            onChange={(v) => {
              const n = safeParseNumber(v);
              if (n !== null) {
                editEvent(lineIndex, eventIndex, {
                  value: { transition: { ...transValue, start: n } },
                });
              }
            }}
            step="0.1"
          />
          <Field
            label="End"
            value={transValue.end}
            onChange={(v) => {
              const n = safeParseNumber(v);
              if (n !== null) {
                editEvent(lineIndex, eventIndex, {
                  value: { transition: { ...transValue, end: n } },
                });
              }
            }}
            step="0.1"
          />
        </>
      ) : (
        <Field
          label="Value"
          value={constValue ?? 0}
          onChange={(v) => {
            const n = safeParseNumber(v);
            if (n !== null) {
              editEvent(lineIndex, eventIndex, { value: { constant: n } });
            }
          }}
          step="0.1"
        />
      )}
    </div>
  );
}
