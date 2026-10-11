// ============================================================
// Inspector Panel — Property editor for notes, events, and lines
//
// Renders editable fields for the current selection: note
// properties (beat, x, kind, speed, hold), event properties
// (start/end beat, value, easing), and line settings (name,
// texture, hierarchy). Auto-switches between note, event, and
// line inspector views based on the active editor selection.
// Note type and side are picked with SegmentedControls (note types
// drawn with NoteGlyph); everything else uses the shared form fields.
// ============================================================

import type React from "react";
import { useMemo, useEffect, useRef, useState } from "react";
import { useChartStore } from "../../stores/chartStore";
import {
  useSelectedLineIndex,
  useSelectedNoteIndices,
  useSelectedEventIndices,
} from "../../stores/selection";
import type { Note, LineEvent, NoteKind, EasingType } from "../../types/chart";
import { Field, SelectField, BeatField, EASING_OPTIONS } from "../common/FormFields";
import { Card, SectionHeader, ActionButton, INPUT_STYLE } from "../common/UIKit";
import { ColorPicker } from "../common/ColorPicker";
import { NoteGlyph } from "../common/NoteGlyph";
import { SegmentedControl, type SegmentOption } from "../common/SegmentedControl";

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  height: "auto",
  resize: "vertical",
  minHeight: 40,
};

const CAPTION_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--text-secondary)",
};

/** "scale_x" → "Scale X", "x" → "X" (sentence case, axis letters upper-case). */
function eventKindLabel(kind: string): string {
  return kind
    .split("_")
    .map((w, i) => (w.length === 1 ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Texture thumbnail + upload/remove for a line's custom texture */
function TexturePreview({ textureName, lineIndex }: { textureName?: string; lineIndex: number }) {
  const lineTextures = useChartStore((s) => s.lineTextures);
  const setLineTexture = useChartStore((s) => s.setLineTexture);
  const editLine = useChartStore((s) => s.editLine);

  const previewUrl = useMemo(() => {
    if (!textureName) return null;
    const blob = lineTextures.get(textureName);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }, [textureName, lineTextures]);

  // Revoke previous blob URLs to prevent memory leaks
  const prevUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrlRef.current && prevUrlRef.current !== previewUrl) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = previewUrl;
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, [previewUrl]);

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.webp,.gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      setLineTexture(file.name, blob);
      editLine(lineIndex, { texture: file.name });
    };
    input.click();
  };

  const handleRemove = () => {
    editLine(lineIndex, { texture: undefined });
  };

  return (
    <div style={{ marginTop: "var(--space-2)", marginBottom: "var(--space-4)" }}>
      {previewUrl && (
        <img
          src={previewUrl}
          alt={textureName}
          style={{
            maxWidth: "100%",
            maxHeight: 80,
            borderRadius: "var(--radius-md)",
            border: "var(--rule) solid var(--border-color)",
            marginBottom: "var(--space-4)",
            objectFit: "contain",
            background: "var(--canvas-bg)",
          }}
        />
      )}
      {textureName && !previewUrl && (
        <div style={{ ...CAPTION_STYLE, marginBottom: "var(--space-4)" }}>
          Image not loaded ({textureName})
        </div>
      )}
      <div style={{ display: "flex", gap: "var(--space-4)" }}>
        <ActionButton variant="primary" onClick={handleUpload}>
          {textureName ? "Change…" : "Add texture…"}
        </ActionButton>
        {textureName && (
          <ActionButton variant="danger" onClick={handleRemove}>
            Remove
          </ActionButton>
        )}
      </div>
    </div>
  );
}

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

/** Label + control row laid out like the shared Field / SelectField. */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Note type picker: one segment per type, drawn with its NoteGlyph. null = mixed selection. */
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

function NoteInspector({ note, lineIndex, noteIndex }: { note: Note; lineIndex: number; noteIndex: number }) {
  const editNote = useChartStore((s) => s.editNote);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-8)" }}>
      <SectionHeader color="var(--text-primary)">Note #{noteIndex}</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <NoteKindPicker
            value={note.kind}
            onChange={(v) => {
              // P6: switching to "hold" without a hold_beat exports a zero-length
              // hold (garbage). Seed one beat so the hold is valid. Same guard in
              // UnifiedInspector.tsx / FloatingInspector.tsx (grep `hold_beat = [1, 0, 1]`).
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
          <Field
            label="X"
            value={note.x}
            onChange={(v) => editNote(lineIndex, noteIndex, { x: parseFloat(v) })}
            step="1"
          />
          <Field
            label="Speed"
            value={note.speed}
            onChange={(v) => { const val = parseFloat(v); editNote(lineIndex, noteIndex, { speed: isNaN(val) ? 1 : val }); }}
            step="0.1"
          />
          <SidePicker
            value={note.above ? "above" : "below"}
            onChange={(v) => editNote(lineIndex, noteIndex, { above: v === "above" })}
          />
          {note.kind === "hold" && note.hold_beat && (
            <BeatField
              label="Hold"
              beat={note.hold_beat}
              onChange={(b) => editNote(lineIndex, noteIndex, { hold_beat: b })}
            />
          )}
        </div>
      </Card>
      <SectionHeader>RPE properties</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Field
            label="Size"
            value={note.size ?? 1}
            onChange={(v) => {
              const val = parseFloat(v);
              editNote(lineIndex, noteIndex, { size: val === 1 ? undefined : (isNaN(val) ? 1 : val) });
            }}
            step="0.1"
          />
          <Field
            label="Alpha"
            value={note.alpha ?? 255}
            onChange={(v) => {
              const val = parseInt(v);
              editNote(lineIndex, noteIndex, { alpha: val === 255 ? undefined : Math.max(0, Math.min(255, isNaN(val) ? 255 : val)) });
            }}
            step="1"
          />
          <Field
            label="Vis. time"
            value={note.visible_time ?? 999999}
            onChange={(v) => {
              const val = parseFloat(v);
              editNote(lineIndex, noteIndex, { visible_time: val === 999999 ? undefined : (isNaN(val) ? 999999 : val) });
            }}
            step="0.5"
          />
          <SelectField
            label="Fake"
            value={note.fake ? "true" : "false"}
            options={[
              { value: "false", label: "No" },
              { value: "true", label: "Yes" },
            ]}
            onChange={(v) => editNote(lineIndex, noteIndex, { fake: v === "true" ? true : undefined })}
          />
          <Field
            label="Y offset"
            value={note.y_offset ?? 0}
            onChange={(v) => {
              const val = parseFloat(v);
              editNote(lineIndex, noteIndex, { y_offset: val === 0 ? undefined : (isNaN(val) ? 0 : val) });
            }}
            step="0.5"
          />
          <Field
            label="Judge area"
            value={note.judge_area ?? 1}
            onChange={(v) => {
              const val = parseFloat(v);
              editNote(lineIndex, noteIndex, { judge_area: val === 1 ? undefined : (isNaN(val) ? 1 : val) });
            }}
            step="0.1"
          />
          <Field
            label="Hit sound"
            type="text"
            value={note.hitsound ?? ""}
            onChange={(v) => editNote(lineIndex, noteIndex, { hitsound: v || undefined })}
          />
        </div>
      </Card>
    </div>
  );
}

function EventInspectorPanel({ event, lineIndex, eventIndex }: { event: LineEvent; lineIndex: number; eventIndex: number }) {
  const editEvent = useChartStore((s) => s.editEvent);
  const [showColorPicker, setShowColorPicker] = useState<"start" | "end" | "constant" | null>(null);

  const isTransition = "transition" in event.value;
  const isColorTransition = "color_transition" in event.value;
  const isColorConstant = "color_constant" in event.value;
  const isTextValue = "text_value" in event.value;
  const isTextTransition = "text_transition" in event.value;
  const isScaleEvent = event.kind === "scale_x" || event.kind === "scale_y";

  const tv = isTransition ? (event.value as { transition: { start: number; end: number; easing: EasingType } }).transition : null;
  const cv = !isTransition && !isColorTransition && !isColorConstant && !isTextValue && !isTextTransition
    ? (event.value as { constant: number }).constant : null;
  const startVal = tv ? tv.start : cv ?? 0;
  const endVal = tv ? tv.end : cv ?? 0;

  const valueStep = isScaleEvent ? "0.01" : "0.1";
  const valueMin = isScaleEvent ? "0" : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-8)" }}>
      <SectionHeader color="var(--text-primary)">Event #{eventIndex} ({eventKindLabel(event.kind)})</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <BeatField
            label="Start"
            beat={event.start_beat}
            onChange={(b) => editEvent(lineIndex, eventIndex, { start_beat: b })}
          />
          <BeatField
            label="End"
            beat={event.end_beat}
            onChange={(b) => editEvent(lineIndex, eventIndex, { end_beat: b })}
          />

          {/* Color event: constant */}
          {isColorConstant && (() => {
            const rgb = (event.value as { color_constant: [number, number, number] }).color_constant;
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "var(--radius-md)",
                    backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
                    border: "var(--rule) solid var(--border-color)",
                  }} />
                  <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    rgb({rgb[0]}, {rgb[1]}, {rgb[2]})
                  </span>
                </div>
                <ActionButton variant="primary" onClick={() => setShowColorPicker("constant")}>
                  Edit color…
                </ActionButton>
                <Field label="R" value={rgb[0]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_constant: [parseInt(v) || 0, rgb[1], rgb[2]] } })} step="1" min="0" max="255" />
                <Field label="G" value={rgb[1]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_constant: [rgb[0], parseInt(v) || 0, rgb[2]] } })} step="1" min="0" max="255" />
                <Field label="B" value={rgb[2]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_constant: [rgb[0], rgb[1], parseInt(v) || 0] } })} step="1" min="0" max="255" />
                {showColorPicker === "constant" && (
                  <ColorPicker
                    value={rgb}
                    onChange={(newRgb) => editEvent(lineIndex, eventIndex, { value: { color_constant: newRgb } })}
                    onClose={() => setShowColorPicker(null)}
                  />
                )}
              </>
            );
          })()}

          {/* Color event: transition */}
          {isColorTransition && (() => {
            const ct = (event.value as { color_transition: { start: [number, number, number]; end: [number, number, number]; easing: EasingType } }).color_transition;
            return (
              <>
                <div style={{ ...CAPTION_STYLE, fontWeight: 600 }}>Start color</div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-2)" }}>
                  <button type="button" aria-label="Edit start color" style={{ width: 16, height: 16, padding: 0, borderRadius: "var(--radius-xs)", backgroundColor: `rgb(${ct.start[0]},${ct.start[1]},${ct.start[2]})`, border: "var(--rule) solid var(--border-color)", cursor: "pointer" }} onClick={() => setShowColorPicker("start")} />
                  <ActionButton onClick={() => setShowColorPicker("start")}>Edit…</ActionButton>
                </div>
                <Field label="R" value={ct.start[0]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, start: [parseInt(v) || 0, ct.start[1], ct.start[2]] } } })} step="1" min="0" max="255" />
                <Field label="G" value={ct.start[1]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, start: [ct.start[0], parseInt(v) || 0, ct.start[2]] } } })} step="1" min="0" max="255" />
                <Field label="B" value={ct.start[2]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, start: [ct.start[0], ct.start[1], parseInt(v) || 0] } } })} step="1" min="0" max="255" />
                <div style={{ ...CAPTION_STYLE, fontWeight: 600, marginTop: "var(--space-4)" }}>End color</div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-2)" }}>
                  <button type="button" aria-label="Edit end color" style={{ width: 16, height: 16, padding: 0, borderRadius: "var(--radius-xs)", backgroundColor: `rgb(${ct.end[0]},${ct.end[1]},${ct.end[2]})`, border: "var(--rule) solid var(--border-color)", cursor: "pointer" }} onClick={() => setShowColorPicker("end")} />
                  <ActionButton onClick={() => setShowColorPicker("end")}>Edit…</ActionButton>
                </div>
                <Field label="R" value={ct.end[0]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, end: [parseInt(v) || 0, ct.end[1], ct.end[2]] } } })} step="1" min="0" max="255" />
                <Field label="G" value={ct.end[1]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, end: [ct.end[0], parseInt(v) || 0, ct.end[2]] } } })} step="1" min="0" max="255" />
                <Field label="B" value={ct.end[2]} onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, end: [ct.end[0], ct.end[1], parseInt(v) || 0] } } })} step="1" min="0" max="255" />
                <SelectField
                  label="Easing"
                  value={typeof ct.easing === "string" ? ct.easing : "linear"}
                  options={EASING_OPTIONS}
                  onChange={(v) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, easing: v as EasingType } } })}
                />
                {showColorPicker === "start" && (
                  <ColorPicker
                    value={ct.start}
                    onChange={(newRgb) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, start: newRgb } } })}
                    onClose={() => setShowColorPicker(null)}
                  />
                )}
                {showColorPicker === "end" && (
                  <ColorPicker
                    value={ct.end}
                    onChange={(newRgb) => editEvent(lineIndex, eventIndex, { value: { color_transition: { ...ct, end: newRgb } } })}
                    onClose={() => setShowColorPicker(null)}
                  />
                )}
              </>
            );
          })()}

          {/* Text event */}
          {isTextValue && (() => {
            const text = (event.value as { text_value: string }).text_value;
            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <label style={CAPTION_STYLE}>Text</label>
                  <textarea
                    aria-label="Text"
                    value={text}
                    onChange={(e) => editEvent(lineIndex, eventIndex, { value: { text_value: e.target.value } })}
                    style={TEXTAREA_STYLE}
                  />
                </div>
                {event.font !== undefined && (
                  <Field label="Font" value={event.font} onChange={(v) => editEvent(lineIndex, eventIndex, { font: v })} type="text" />
                )}
              </>
            );
          })()}

          {/* Text transition event (with easing) */}
          {isTextTransition && (() => {
            const tt = (event.value as { text_transition: { start: string; end: string; easing: EasingType } }).text_transition;
            return (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <label style={CAPTION_STYLE}>Start text</label>
                  <textarea
                    aria-label="Start text"
                    value={tt.start}
                    onChange={(e) => editEvent(lineIndex, eventIndex, { value: { text_transition: { ...tt, start: e.target.value } } })}
                    style={TEXTAREA_STYLE}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  <label style={CAPTION_STYLE}>End text</label>
                  <textarea
                    aria-label="End text"
                    value={tt.end}
                    onChange={(e) => editEvent(lineIndex, eventIndex, { value: { text_transition: { ...tt, end: e.target.value } } })}
                    style={TEXTAREA_STYLE}
                  />
                </div>
                {event.font !== undefined && (
                  <Field label="Font" value={event.font} onChange={(v) => editEvent(lineIndex, eventIndex, { font: v })} type="text" />
                )}
              </>
            );
          })()}

          {/* Standard numeric event (transition or constant) */}
          {!isColorTransition && !isColorConstant && !isTextValue && !isTextTransition && (
            <>
              <SelectField
                label="Type"
                value={isTransition ? "transition" : "constant"}
                options={[
                  { value: "transition", label: "Transition" },
                  { value: "constant", label: "Constant" },
                ]}
                onChange={(v) => {
                  if (v === "constant") {
                    editEvent(lineIndex, eventIndex, { value: { constant: startVal } });
                  } else {
                    editEvent(lineIndex, eventIndex, {
                      value: { transition: { start: startVal, end: endVal, easing: "linear" } },
                    });
                  }
                }}
              />
              {isTransition && tv ? (
                <>
                  <Field
                    label={isScaleEvent ? "Start scale" : "Start val"}
                    value={startVal}
                    onChange={(v) =>
                      editEvent(lineIndex, eventIndex, {
                        value: {
                          transition: {
                            start: parseFloat(v),
                            end: tv.end,
                            easing: tv.easing,
                          },
                        },
                      })
                    }
                    step={valueStep}
                    min={valueMin}
                  />
                  <Field
                    label={isScaleEvent ? "End scale" : "End val"}
                    value={endVal}
                    onChange={(v) =>
                      editEvent(lineIndex, eventIndex, {
                        value: {
                          transition: {
                            start: tv.start,
                            end: parseFloat(v),
                            easing: tv.easing,
                          },
                        },
                      })
                    }
                    step={valueStep}
                    min={valueMin}
                  />
                  <SelectField
                    label="Easing"
                    value={typeof tv.easing === "string" ? tv.easing : "linear"}
                    options={EASING_OPTIONS}
                    onChange={(v) =>
                      editEvent(lineIndex, eventIndex, {
                        value: {
                          transition: {
                            start: tv.start,
                            end: tv.end,
                            easing: v as EasingType,
                          },
                        },
                      })
                    }
                  />
                  <Field
                    label="Ease left"
                    value={event.easing_left ?? 0}
                    onChange={(v) => editEvent(lineIndex, eventIndex, { easing_left: parseFloat(v) })}
                    step="0.05"
                  />
                  <Field
                    label="Ease right"
                    value={event.easing_right ?? 1}
                    onChange={(v) => { const val = parseFloat(v); editEvent(lineIndex, eventIndex, { easing_right: isNaN(val) ? 1 : val }); }}
                    step="0.05"
                  />
                </>
              ) : (
                <Field
                  label={isScaleEvent ? "Scale" : "Value"}
                  value={startVal}
                  onChange={(v) =>
                    editEvent(lineIndex, eventIndex, { value: { constant: parseFloat(v) } })
                  }
                  step={valueStep}
                  min={valueMin}
                />
              )}
              {isScaleEvent && (
                <div style={{ ...CAPTION_STYLE, padding: "0 0 0 var(--space-4)" }}>
                  0.0 = invisible, 1.0 = normal, 2.0 = double size
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function LineInspector({ lineIndex }: { lineIndex: number }) {
  const line = useChartStore((s) => s.chart.lines[lineIndex]);
  const editLine = useChartStore((s) => s.editLine);

  if (!line) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-8)" }}>
      <SectionHeader color="var(--text-primary)">Line #{lineIndex}</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Field
            label="Name"
            type="text"
            value={line.name}
            onChange={(v) => editLine(lineIndex, { name: v })}
          />
          <div style={CAPTION_STYLE}>
            {line.notes.length} notes, {line.events.length} events
            {line.event_layers && line.event_layers.length > 0 ? `, ${line.event_layers.length} layers` : ""}
          </div>
        </div>
      </Card>
      <SectionHeader>RPE properties</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Field
            label="Z order"
            value={line.z_order ?? 0}
            onChange={(v) => {
              const val = parseInt(v);
              editLine(lineIndex, { z_order: val === 0 ? undefined : val });
            }}
            step="1"
          />
          <SelectField
            label="Is cover"
            value={line.is_cover === false ? "false" : "true"}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
            onChange={(v) => editLine(lineIndex, { is_cover: v === "false" ? false : undefined })}
          />
          <Field
            label="BPM factor"
            value={line.bpm_factor ?? 1}
            onChange={(v) => {
              const val = parseFloat(v);
              editLine(lineIndex, { bpm_factor: val === 1 ? undefined : (isNaN(val) ? 1 : val) });
            }}
            step="0.1"
          />
          <Field
            label="Group"
            value={line.group ?? 0}
            onChange={(v) => {
              const val = parseInt(v);
              editLine(lineIndex, { group: val === 0 ? undefined : val });
            }}
            step="1"
          />
          <Field
            label="Texture"
            type="text"
            value={line.texture ?? ""}
            onChange={(v) => editLine(lineIndex, { texture: v || undefined })}
          />
          <TexturePreview textureName={line.texture} lineIndex={lineIndex} />
          <SelectField
            label="Rotate with father"
            value={line.rotate_with_father === false ? "false" : "true"}
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
            onChange={(v) => editLine(lineIndex, { rotate_with_father: v === "false" ? false : undefined })}
          />
          <Field
            label="Father index"
            value={line.father_index ?? -1}
            onChange={(v) => {
              const val = parseInt(v);
              editLine(lineIndex, { father_index: val === -1 ? undefined : val });
            }}
            step="1"
          />
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
            options={[
              { value: "false", label: "No" },
              { value: "true", label: "Yes" },
            ]}
            onChange={(v) => editLine(lineIndex, { is_gif: v === "true" ? true : undefined })}
          />
        </div>
      </Card>
      <SectionHeader>Incline and GIF hints</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={CAPTION_STYLE}>
            <strong>Incline events</strong> control 3D tilt perspective. Values are in degrees.
          </div>
          <div style={CAPTION_STYLE}>
            <strong>GIF events</strong> control animated texture playback. 0.0 = start, 1.0 = end (step 0.01).
          </div>
          <div style={CAPTION_STYLE}>
            Set <strong>Is GIF = Yes</strong> to mark this line's texture as an animated GIF.
          </div>
        </div>
      </Card>
    </div>
  );
}

function MultiNoteInspector({ count, lineIndex, indices }: { count: number; lineIndex: number; indices: number[] }) {
  const editNotes = useChartStore((s) => s.editNotes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-8)" }}>
      <SectionHeader color="var(--text-primary)">{count} notes selected</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Mixed selection: no segment is pre-selected; picking one applies it to all */}
          <NoteKindPicker
            value={null}
            onChange={(v) => editNotes(lineIndex, indices, { kind: v })}
          />
          <SidePicker
            value={null}
            onChange={(v) => editNotes(lineIndex, indices, { above: v === "above" })}
          />
        </div>
      </Card>
      <SectionHeader>RPE properties</SectionHeader>
      <Card>
        <div style={{ padding: "var(--space-6) var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <Field
            label="Size"
            type="text"
            value=""
            onChange={(v) => {
              const val = parseFloat(v);
              if (!isNaN(val)) editNotes(lineIndex, indices, { size: val === 1 ? undefined : val });
            }}
          />
          <Field
            label="Alpha"
            type="text"
            value=""
            onChange={(v) => {
              const val = parseInt(v);
              if (!isNaN(val)) editNotes(lineIndex, indices, { alpha: val === 255 ? undefined : Math.max(0, Math.min(255, val)) });
            }}
          />
          <Field
            label="Vis. time"
            type="text"
            value=""
            onChange={(v) => {
              const val = parseFloat(v);
              if (!isNaN(val)) editNotes(lineIndex, indices, { visible_time: val === 999999 ? undefined : val });
            }}
          />
          <SelectField
            label="Fake"
            value=""
            options={[
              { value: "", label: "(mixed)" },
              { value: "false", label: "No" },
              { value: "true", label: "Yes" },
            ]}
            onChange={(v) => {
              if (v) editNotes(lineIndex, indices, { fake: v === "true" ? true : undefined });
            }}
          />
        </div>
      </Card>
    </div>
  );
}

export function Inspector() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const selectedEventIndices = useSelectedEventIndices();
  const chart = useChartStore((s) => s.chart);

  if (selectedLineIndex === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          No line selected
        </span>
      </div>
    );
  }

  const line = chart.lines[selectedLineIndex];
  if (!line) return null;

  // Single note selected
  if (selectedNoteIndices.length === 1) {
    const note = line.notes[selectedNoteIndices[0]];
    if (note) {
      return (
        <div style={{ overflowY: "auto", height: "100%" }}>
          <NoteInspector
            note={note}
            lineIndex={selectedLineIndex}
            noteIndex={selectedNoteIndices[0]}
          />
        </div>
      );
    }
  }

  // Multiple notes selected
  if (selectedNoteIndices.length > 1) {
    return (
      <div style={{ overflowY: "auto", height: "100%" }}>
        <MultiNoteInspector
          count={selectedNoteIndices.length}
          lineIndex={selectedLineIndex}
          indices={selectedNoteIndices}
        />
      </div>
    );
  }

  // Single event selected
  if (selectedEventIndices.length === 1) {
    const event = line.events[selectedEventIndices[0]];
    if (event) {
      return (
        <div style={{ overflowY: "auto", height: "100%" }}>
          <EventInspectorPanel
            event={event}
            lineIndex={selectedLineIndex}
            eventIndex={selectedEventIndices[0]}
          />
        </div>
      );
    }
  }

  // Multiple events selected
  if (selectedEventIndices.length > 1) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          {selectedEventIndices.length} events selected
        </span>
      </div>
    );
  }

  // Nothing selected — show line info
  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      <LineInspector lineIndex={selectedLineIndex} />
    </div>
  );
}
