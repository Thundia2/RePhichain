// ============================================================
// Unified Inspector — Collapsible right sidebar
//
// 210px wide, context-sensitive property panel for the unified editor.
// Shows: current evaluated values, line/note/event properties, layer selector.
// Note type, side and layer use SegmentedControls (note types drawn with
// NoteGlyph); section headers are sentence case in text-secondary.
// ============================================================

import type React from "react";
import { useMemo } from "react";
import { X } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import {
  useSelectedLineIndex,
  useSelectedNoteIndices,
  useSelectedEventIndices,
} from "../../stores/selection";
import { useAudioStore } from "../../stores/audioStore";
import { getPlayheadBeat } from "../../utils/playhead";
import { evaluateLineEventsWithLayers } from "../../canvas/events";
import type { Note, LineEvent, NoteKind, EasingType, LineEventKind } from "../../types/chart";
import { Field, SelectField, BeatField, EASING_OPTIONS } from "../common/FormFields";
import { BatchNoteOps } from "../common/BatchNoteOps";
import { EVENT_COLORS } from "../../constants/eventColors";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { BOOKMARK_PRESET_KEYS } from "../../types/bookmark";
import { bookmarkColor } from "../../canvas/chromeTheme";
import type { BookmarkPreset } from "../../types/bookmark";
import { NoteGlyph } from "../common/NoteGlyph";
import { SegmentedControl, type SegmentOption } from "../common/SegmentedControl";
import { IconButton } from "../common/IconButton";
import { Button } from "../common/Button";

// ============================================================
// Constants
// ============================================================

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

const LAYER_SEGMENTS: SegmentOption<number>[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ value: i, label: `L${i}`, title: `Layer ${i}` })),
  { value: -1, label: "Flat", title: "Flat events" },
];

const VALUE_PROPS: { key: string; kind: LineEventKind; label: string }[] = [
  { key: "x", kind: "x", label: "X" },
  { key: "y", kind: "y", label: "Y" },
  { key: "rotation", kind: "rotation", label: "Rotation" },
  { key: "opacity", kind: "opacity", label: "Opacity" },
  { key: "speed", kind: "speed", label: "Speed" },
];

const SECTION_STYLE: React.CSSProperties = {
  padding: "var(--space-8) var(--space-10)",
  borderBottom: "var(--rule) solid var(--separator)",
};

const DIVIDER_STYLE: React.CSSProperties = {
  height: 1, background: "var(--separator)", margin: "var(--space-8) 0",
};

/** "scale_x" → "Scale X", "x" → "X" (sentence case, axis letters upper-case). */
function eventKindLabel(kind: string): string {
  return kind
    .split("_")
    .map((w, i) => (w.length === 1 ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ============================================================
// Sub-components
// ============================================================

/** Sentence-case section label; pass color="var(--text-primary)" for the selection title. */
function SectionHeader({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: "var(--fs-control)",
        lineHeight: "14px",
        fontWeight: 600,
        color: color || "var(--text-secondary)",
        marginBottom: "var(--space-6)",
      }}
    >
      {children}
    </div>
  );
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

/** Note type picker drawn with NoteGlyphs. null = mixed selection. */
function NoteKindPicker({ value, onChange }: { value: NoteKind | null; onChange: (k: NoteKind) => void }) {
  return (
    <FieldRow label="Kind">
      <SegmentedControl options={NOTE_KIND_SEGMENTS} value={value} onChange={onChange} size="sm" block label="Note type" />
    </FieldRow>
  );
}

/** Above / below picker. null = mixed selection. */
function SidePicker({ value, onChange }: { value: "above" | "below" | null; onChange: (v: "above" | "below") => void }) {
  return (
    <FieldRow label="Side">
      <SegmentedControl options={SIDE_SEGMENTS} value={value} onChange={onChange} size="sm" block label="Side" />
    </FieldRow>
  );
}

function NoteSection({ note, lineIndex, noteIndex }: { note: Note; lineIndex: number; noteIndex: number }) {
  const editNote = useChartStore((s) => s.editNote);

  return (
    <div style={SECTION_STYLE}>
      <SectionHeader color="var(--text-primary)">Note #{noteIndex}</SectionHeader>
      <NoteKindPicker
        value={note.kind}
        onChange={(v) => {
          // P6: switching to "hold" without a hold_beat exports a zero-length hold
          // (garbage). Seed one beat so the new hold is valid. Mirrors the same
          // guard in FloatingInspector.tsx (grep `hold_beat = [1, 0, 1]`).
          const changes: Partial<Note> = { kind: v as NoteKind };
          if (v === "hold" && !note.hold_beat) changes.hold_beat = [1, 0, 1];
          editNote(lineIndex, noteIndex, changes);
        }}
      />
      <BeatField
        label="Beat"
        beat={note.beat}
        onChange={(b) => editNote(lineIndex, noteIndex, { beat: b })}
      />
      <Field label="X" value={note.x} onChange={(v) => editNote(lineIndex, noteIndex, { x: parseFloat(v) })} step="1" />
      {/* L8/UC8: no `|| 1` — Field only emits a valid number string, so the fallback only ever blocked a real 0 / negative speed (reverse-approach technique). */}
      <Field label="Speed" value={note.speed} onChange={(v) => editNote(lineIndex, noteIndex, { speed: parseFloat(v) })} step="0.1" />
      <SidePicker
        value={note.above ? "above" : "below"}
        onChange={(v) => editNote(lineIndex, noteIndex, { above: v === "above" })}
      />
      {note.kind === "hold" && note.hold_beat && (
        <BeatField label="Hold" beat={note.hold_beat} onChange={(b) => editNote(lineIndex, noteIndex, { hold_beat: b })} />
      )}
      <div style={DIVIDER_STYLE} />
      <SectionHeader>RPE properties</SectionHeader>
      <Field label="Size" value={note.size ?? 1} onChange={(v) => { const val = parseFloat(v); editNote(lineIndex, noteIndex, { size: val === 1 ? undefined : val || 1 }); }} step="0.1" />
      {/* L8/UC8: no `val || 255` — alpha 0 is a valid invisible-note technique; only clamp to [0,255]. */}
      <Field label="Alpha" value={note.alpha ?? 255} onChange={(v) => { const val = parseInt(v); editNote(lineIndex, noteIndex, { alpha: val === 255 ? undefined : Math.max(0, Math.min(255, val)) }); }} step="1" />
      <Field label="Vis. time" value={note.visible_time ?? 999999} onChange={(v) => { const val = parseFloat(v); editNote(lineIndex, noteIndex, { visible_time: val === 999999 ? undefined : isNaN(val) ? 999999 : val }); }} step="0.5" />
      <SelectField
        label="Fake"
        value={note.fake ? "true" : "false"}
        options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
        onChange={(v) => editNote(lineIndex, noteIndex, { fake: v === "true" ? true : undefined })}
      />
      <details style={{ marginTop: "var(--space-8)" }}>
        <summary style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", cursor: "pointer" }}>
          Advanced properties
        </summary>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Field label="Y offset" value={note.y_offset ?? 0} onChange={(v) => {
            const val = parseFloat(v);
            editNote(lineIndex, noteIndex, { y_offset: val === 0 ? undefined : isNaN(val) ? undefined : val });
          }} step="0.1" />
          <Field label="Judge area" value={note.judge_area ?? 1} onChange={(v) => {
            const val = parseFloat(v);
            editNote(lineIndex, noteIndex, { judge_area: val === 1 ? undefined : isNaN(val) ? undefined : val });
          }} step="0.1" />
          <Field label="Hit sound" value={note.hitsound ?? ""} type="text" onChange={(v) => {
            editNote(lineIndex, noteIndex, { hitsound: v || undefined });
          }} />
        </div>
      </details>
    </div>
  );
}

function MultiNoteSection({ count, lineIndex, indices }: { count: number; lineIndex: number; indices: number[] }) {
  const editNotes = useChartStore((s) => s.editNotes);

  return (
    <div style={SECTION_STYLE}>
      <SectionHeader color="var(--text-primary)">{count} notes selected</SectionHeader>
      {/* Mixed selection: no segment is pre-selected; picking one applies it to all */}
      <NoteKindPicker value={null} onChange={(v) => editNotes(lineIndex, indices, { kind: v })} />
      <SidePicker value={null} onChange={(v) => editNotes(lineIndex, indices, { above: v === "above" })} />
    </div>
  );
}

function EventSection({ event, lineIndex, eventIndex }: { event: LineEvent; lineIndex: number; eventIndex: number }) {
  const editEvent = useChartStore((s) => s.editEvent);
  const isTransition = "transition" in event.value;
  const tv = isTransition ? (event.value as { transition: { start: number; end: number; easing: EasingType } }).transition : null;
  const cv = !isTransition ? (event.value as { constant: number }).constant : null;
  const startVal = tv ? tv.start : cv!;
  const endVal = tv ? tv.end : cv!;
  return (
    <div style={SECTION_STYLE}>
      <SectionHeader color="var(--text-primary)">Event #{eventIndex} · {eventKindLabel(event.kind)}</SectionHeader>
      <BeatField label="Start" beat={event.start_beat} onChange={(b) => editEvent(lineIndex, eventIndex, { start_beat: b })} />
      <BeatField label="End" beat={event.end_beat} onChange={(b) => editEvent(lineIndex, eventIndex, { end_beat: b })} />
      <SelectField
        label="Type"
        value={isTransition ? "transition" : "constant"}
        options={[{ value: "transition", label: "Transition" }, { value: "constant", label: "Constant" }]}
        onChange={(v) => {
          if (v === "constant") editEvent(lineIndex, eventIndex, { value: { constant: startVal } });
          else editEvent(lineIndex, eventIndex, { value: { transition: { start: startVal, end: endVal, easing: "linear" } } });
        }}
      />
      {isTransition && tv ? (
        <>
          <Field label="Start val" value={startVal} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { transition: { start: parseFloat(v), end: tv.end, easing: tv.easing } } })} step="0.1" />
          <Field label="End val" value={endVal} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { transition: { start: tv.start, end: parseFloat(v), easing: tv.easing } } })} step="0.1" />
          <SelectField
            label="Easing"
            value={typeof tv.easing === "string" ? tv.easing : "linear"}
            options={EASING_OPTIONS}
            onChange={(v) => editEvent(lineIndex, eventIndex, { value: { transition: { start: tv.start, end: tv.end, easing: v as EasingType } } })}
          />
          <Field label="Ease left" value={event.easing_left ?? 0} onChange={(v) => editEvent(lineIndex, eventIndex, { easing_left: parseFloat(v) })} step="0.05" />
          <Field label="Ease right" value={event.easing_right ?? 1} onChange={(v) => editEvent(lineIndex, eventIndex, { easing_right: parseFloat(v) || 1 })} step="0.05" />
        </>
      ) : (
        <Field label="Value" value={startVal} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { constant: parseFloat(v) } })} step="0.1" />
      )}
    </div>
  );
}

function LineSection({ lineIndex }: { lineIndex: number }) {
  const line = useChartStore((s) => s.chart.lines[lineIndex]);
  const editLine = useChartStore((s) => s.editLine);

  if (!line) return null;

  const fields: [string, string | number][] = [
    ["Name", line.name || `Line ${lineIndex}`],
    ["Z order", String(line.z_order ?? 0)],
    ["Is cover", line.is_cover === false ? "false" : "true"],
    ["BPM factor", String(line.bpm_factor ?? 1.0)],
    ["Father", line.father_index != null ? String(line.father_index) : "none"],
    ["Group", String(line.group ?? 0)],
  ];

  return (
    <div style={SECTION_STYLE}>
      <SectionHeader color="var(--text-primary)">Line #{lineIndex}</SectionHeader>
      {fields.map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
          <span style={{ width: 70, color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>{k}</span>
          <div
            style={{
              flex: 1,
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-2) var(--space-6)",
              color: "var(--text-primary)",
              fontSize: "var(--fs-caption)",
              border: "var(--hairline) solid var(--border-color)",
            }}
          >
            {v}
          </div>
        </div>
      ))}
      <div style={DIVIDER_STYLE} />
      <SectionHeader>Editable</SectionHeader>
      <Field label="Name" type="text" value={line.name} onChange={(v) => editLine(lineIndex, { name: v })} />
      <Field label="Z order" value={line.z_order ?? 0} onChange={(v) => editLine(lineIndex, { z_order: parseInt(v) === 0 ? undefined : parseInt(v) })} step="1" />
      <Field label="BPM factor" value={line.bpm_factor ?? 1} onChange={(v) => { const val = parseFloat(v); editLine(lineIndex, { bpm_factor: val === 1 ? undefined : val || 1 }); }} step="0.1" />
      <Field label="Father" value={line.father_index ?? -1} onChange={(v) => { const val = parseInt(v); editLine(lineIndex, { father_index: val === -1 ? undefined : val }); }} step="1" />
      <SelectField
        label="Attach UI"
        value={line.attach_ui ?? ""}
        options={[
          { value: "", label: "None" },
          { value: "pause", label: "Pause button" },
          { value: "combonumber", label: "Combo number" },
          { value: "combo", label: "Combo label" },
          { value: "score", label: "Score" },
          { value: "bar", label: "Progress bar" },
          { value: "name", label: "Song name" },
          { value: "level", label: "Level label" },
        ]}
        onChange={(v) => editLine(lineIndex, { attach_ui: v || undefined })}
      />
      <SelectField
        label="Is GIF"
        value={line.is_gif ? "true" : "false"}
        options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]}
        onChange={(v) => editLine(lineIndex, { is_gif: v === "true" ? true : undefined })}
      />
    </div>
  );
}

// ============================================================
// Bookmark Inspector Sections
// ============================================================

function PresetDots({ activePreset, onSelect }: { activePreset?: BookmarkPreset; onSelect: (p: BookmarkPreset) => void }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)" }}>
      {BOOKMARK_PRESET_KEYS.map((preset) => (
        <IconButton
          key={preset}
          label={`${preset[0].toUpperCase()}${preset.slice(1)} color`}
          size="sm"
          active={activePreset === undefined ? undefined : activePreset === preset}
          onClick={() => onSelect(preset)}
        >
          {/* Preset swatch — the --mark-<preset> token */}
          <span style={{ width: 12, height: 12, borderRadius: "var(--radius-xs)", background: bookmarkColor(preset) }} />
        </IconButton>
      ))}
    </div>
  );
}

function BookmarkSection({ bookmarkId }: { bookmarkId: string }) {
  const bookmark = useBookmarkStore((s) => s.bookmarks.find((b) => b.id === bookmarkId));
  if (!bookmark) return null;

  const store = useBookmarkStore.getState();

  return (
    <div style={{ ...SECTION_STYLE, padding: "var(--space-8) var(--space-12)" }}>
      <SectionHeader color="var(--text-primary)">Marker</SectionHeader>
      <PresetDots
        activePreset={bookmark.preset}
        onSelect={(p) => store.setBookmarkColor(bookmarkId, p)}
      />
      <BeatField
        label="Beat"
        beat={bookmark.beat}
        onChange={(v) => store.updateBookmark(bookmarkId, { beat: v })}
      />
      <Field
        label="X"
        value={bookmark.x}
        onChange={(v) => store.updateBookmark(bookmarkId, { x: parseInt(v) })}
        step="1"
      />
      <SidePicker
        value={bookmark.above ? "above" : "below"}
        onChange={(v) => store.updateBookmark(bookmarkId, { above: v === "above" })}
      />
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
        <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => store.convertToNotes([bookmarkId])}>
          Convert to note
        </Button>
        <Button variant="danger" size="sm" onClick={() => store.removeBookmark(bookmarkId)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

function MultiBookmarkSection({ ids }: { ids: string[] }) {
  const store = useBookmarkStore.getState();

  return (
    <div style={{ ...SECTION_STYLE, padding: "var(--space-8) var(--space-12)" }}>
      <SectionHeader color="var(--text-primary)">{ids.length} markers selected</SectionHeader>
      <PresetDots
        onSelect={(p) => {
          for (const id of ids) store.setBookmarkColor(id, p);
        }}
      />
      <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
        <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => store.convertToNotes(ids)}>
          Convert all to notes
        </Button>
        <Button variant="danger" size="sm" onClick={() => store.deleteSelected()}>
          Delete all
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function UnifiedInspector() {
  const inspectorOpen = useEditorStore((s) => s.unifiedInspectorOpen);
  const toggleInspector = useEditorStore((s) => s.toggleUnifiedInspector);
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const selectedEventIndices = useSelectedEventIndices();
  const activeLayer = useEditorStore((s) => s.eventEditorActiveLayer);
  const setActiveLayer = useEditorStore((s) => s.setEventEditorActiveLayer);
  const chart = useChartStore((s) => s.chart);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const selectedBookmarkIds = useBookmarkStore((s) => s.selectedBookmarkIds);

  const line = selectedLineIndex !== null ? chart.lines[selectedLineIndex] : null;
  const hasLayers = line?.event_layers != null && line.event_layers.length > 0;

  // Compute current evaluated values
  const evalValues = useMemo(() => {
    if (!line) return null;
    try {
      const beat = getPlayheadBeat();
      const state = evaluateLineEventsWithLayers(line.events, line.event_layers, beat);
      return state;
    } catch {
      return null;
    }
  }, [line, isPlaying, selectedLineIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentBeat = useMemo(() => {
    try {
      return getPlayheadBeat();
    } catch {
      return 0;
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        width: inspectorOpen ? 220 : 0,
        overflow: "hidden",
        transition: "width var(--dur-base) var(--ease-out)",
        borderLeft: inspectorOpen ? "var(--rule) solid var(--border-color)" : "none",
        background: "var(--bg-secondary)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 220, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div
          style={{
            padding: "var(--space-6) var(--space-8) var(--space-6) var(--space-12)",
            borderBottom: "var(--rule) solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-control)" }}>
            Inspector
          </span>
          <IconButton icon={X} label="Close inspector" size="md" tooltipPosition="left" onClick={toggleInspector} />
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Current Values section */}
          {line && (
            <div style={{ padding: "var(--space-10) var(--space-12)", borderBottom: "var(--rule) solid var(--separator)" }}>
              <SectionHeader>Current values</SectionHeader>
              <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-6)", fontFamily: "var(--font-mono)" }}>
                Beat {currentBeat.toFixed(2)}
              </div>
              {VALUE_PROPS.map(({ kind, label }) => {
                const val = evalValues
                  ? kind === "x" ? evalValues.x
                    : kind === "y" ? evalValues.y
                    : kind === "rotation" ? (evalValues.rotation * 180 / Math.PI)
                    : kind === "opacity" ? (evalValues.opacity * 255)
                    : kind === "speed" ? 1 // speed isn't in LineState directly
                    : 0
                  : 0;
                return (
                  <div key={kind} style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", padding: "3px 0" }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "var(--radius-xs)",
                        background: EVENT_COLORS[kind] || "var(--text-secondary)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ width: 52, fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{val.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Context-sensitive content */}
          {selectedLineIndex === null && (
            <div style={{ padding: "var(--space-20)", textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--fs-control)" }}>
              No line selected
            </div>
          )}

          {selectedLineIndex !== null && selectedNoteIndices.length === 1 && line && (
            <NoteSection
              note={line.notes[selectedNoteIndices[0]]}
              lineIndex={selectedLineIndex}
              noteIndex={selectedNoteIndices[0]}
            />
          )}

          {selectedLineIndex !== null && selectedNoteIndices.length > 1 && (
            <>
              <MultiNoteSection
                count={selectedNoteIndices.length}
                lineIndex={selectedLineIndex}
                indices={selectedNoteIndices}
              />
              <BatchNoteOps />
            </>
          )}

          {selectedLineIndex !== null && selectedNoteIndices.length === 0 && selectedEventIndices.length === 1 && line && (
            <EventSection
              event={line.events[selectedEventIndices[0]]}
              lineIndex={selectedLineIndex}
              eventIndex={selectedEventIndices[0]}
            />
          )}

          {selectedLineIndex !== null && selectedNoteIndices.length === 0 && selectedEventIndices.length > 1 && (
            <div style={{ ...SECTION_STYLE, padding: "var(--space-8) var(--space-12)" }}>
              <SectionHeader color="var(--text-primary)">{selectedEventIndices.length} events selected</SectionHeader>
            </div>
          )}

          {selectedBookmarkIds.length === 1 && (
            <BookmarkSection bookmarkId={selectedBookmarkIds[0]} />
          )}

          {selectedBookmarkIds.length > 1 && (
            <MultiBookmarkSection ids={selectedBookmarkIds} />
          )}

          {selectedLineIndex !== null && selectedNoteIndices.length === 0 && selectedEventIndices.length === 0 && (
            <LineSection lineIndex={selectedLineIndex} />
          )}

          {/* Layer selector */}
          {hasLayers && (
            <div style={{ padding: "var(--space-8) var(--space-12)" }}>
              <SectionHeader>Event layer</SectionHeader>
              <SegmentedControl
                options={LAYER_SEGMENTS}
                value={activeLayer}
                onChange={setActiveLayer}
                tone="accent"
                size="sm"
                block
                label="Event layer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
