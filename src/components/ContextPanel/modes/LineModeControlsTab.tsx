// ============================================================
// LineMode — Controls Sub-tab
//
// RPE Note Controls editor (alpha, size, pos, y, skew) and
// Timeline Overlay line comparison feature. Extracted from
// LineMode.tsx for size management.
// ============================================================

import type React from "react";
import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectedLineIndex } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import type { NoteControlEntry, EasingType } from "../../../types/chart";
import { EASING_OPTIONS, NumericInput } from "../../common/FormFields";
import { SectionHeader } from "../shared/SectionHeader";
import { Icon } from "../../common/Icon";
import { IconButton } from "../../common/IconButton";
import { Button } from "../../common/Button";
import { Toggle, INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";

// ---- Control kind definitions ----

const CONTROL_KINDS = [
  { field: "pos_control" as const, label: "Position (X)", hint: "Multiplier for note X offset based on distance from line", defaultValue: 1.0 },
  { field: "alpha_control" as const, label: "Alpha", hint: "Note opacity (0-1) by distance from line", defaultValue: 1.0 },
  { field: "size_control" as const, label: "Size", hint: "Note size multiplier by distance from line", defaultValue: 1.0 },
  { field: "y_control" as const, label: "Y offset", hint: "Note vertical offset by distance from line", defaultValue: 0 },
  { field: "skew_control" as const, label: "Skew", hint: "Note skew/shear by distance from line", defaultValue: 0 },
] as const;

type ControlField = typeof CONTROL_KINDS[number]["field"];

const GRID_COLUMNS = "56px 64px 1fr 20px";

const CELL_INPUT: React.CSSProperties = {
  ...INPUT_STYLE, width: "100%", minWidth: 0, padding: "0 var(--space-4)", fontFamily: "var(--font-mono)",
};

// ---- Controls Tab ----

export function ControlsTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const lines = useChartStore((s) => s.chart.lines);
  const editLine = useChartStore((s) => s.editLine);
  const [expandedKind, setExpandedKind] = useState<ControlField | null>(null);

  if (selectedLineIndex === null) return null;
  const line = lines[selectedLineIndex];
  if (!line) return null;

  const getEntries = (field: ControlField): NoteControlEntry[] => {
    return (line[field] as NoteControlEntry[] | undefined) ?? [];
  };

  const setEntries = (field: ControlField, entries: NoteControlEntry[]) => {
    editLine(selectedLineIndex, { [field]: entries.length > 0 ? entries : undefined });
  };

  const addEntry = (field: ControlField, defaultValue: number) => {
    const current = getEntries(field);
    const maxX = current.length > 0 ? Math.max(...current.map((e) => e.x)) : 0;
    const newEntry: NoteControlEntry = {
      x: maxX + 100,
      easing: "linear" as EasingType,
      value: defaultValue,
    };
    setEntries(field, [...current, newEntry]);
  };

  const updateEntry = (field: ControlField, index: number, changes: Partial<NoteControlEntry>) => {
    const entries = [...getEntries(field)];
    entries[index] = { ...entries[index], ...changes };
    entries.sort((a, b) => a.x - b.x);
    setEntries(field, entries);
  };

  const removeEntry = (field: ControlField, index: number) => {
    const entries = getEntries(field).filter((_, i) => i !== index);
    setEntries(field, entries);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-4) 0" }}>
      <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", padding: "0 var(--space-6)" }}>
        RPE note controls — define how note appearance changes based on distance from the judgment line.
      </div>
      {CONTROL_KINDS.map((kind) => {
        const entries = getEntries(kind.field);
        const isExpanded = expandedKind === kind.field;
        return (
          <div key={kind.field} style={{
            background: "var(--bg-active)", borderRadius: "var(--radius-xl)", overflow: "hidden",
          }}>
            {/* Header */}
            <button
              type="button"
              className="ui-hover"
              aria-expanded={isExpanded}
              onClick={() => setExpandedKind(isExpanded ? null : kind.field)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", minHeight: "var(--control-lg)", padding: "var(--space-4) var(--space-10)",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                color: "var(--text-primary)",
              }}
            >
              <span style={{ fontSize: "var(--fs-control)", fontWeight: 600 }}>
                {kind.label}
                <span style={{ fontWeight: 400, color: "var(--text-secondary)", marginLeft: "var(--space-6)", fontSize: "var(--fs-caption)" }}>
                  {entries.length > 0 ? `${entries.length} pts` : "Off"}
                </span>
              </span>
              <Icon icon={isExpanded ? ChevronDown : ChevronRight} size={12} style={{ color: "var(--text-secondary)" }} />
            </button>

            {/* Expanded: entries table + add button */}
            {isExpanded && (
              <div style={{ padding: "var(--space-4) var(--space-8) var(--space-8)", borderTop: "var(--rule) solid var(--separator)" }}>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>{kind.hint}</div>

                {entries.length === 0 ? (
                  <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", padding: "var(--space-6) 0", textAlign: "center" }}>
                    No control points. Add one to enable this control.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: "var(--space-4)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)", padding: "0 var(--space-2)" }}>
                      <span>Dist</span>
                      <span>Value</span>
                      <span>Easing</span>
                      <span></span>
                    </div>
                    {entries.map((entry, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: "var(--space-4)", alignItems: "center" }}>
                        <NumericInput
                          commitMode="blur"
                          fallback={0}
                          value={entry.x}
                          onChange={(v) => updateEntry(kind.field, i, { x: v })}
                          title="Distance from line"
                          style={CELL_INPUT}
                          step={10}
                        />
                        <NumericInput
                          commitMode="blur"
                          fallback={0}
                          value={entry.value}
                          onChange={(v) => updateEntry(kind.field, i, { value: v })}
                          title="Value"
                          style={CELL_INPUT}
                          step={0.1}
                        />
                        <select
                          aria-label="Easing"
                          value={String(entry.easing)}
                          onChange={(e) => updateEntry(kind.field, i, { easing: e.target.value as EasingType })}
                          style={{ ...SELECT_STYLE, width: "100%", minWidth: 0, padding: "0 var(--space-4)" }}
                        >
                          {EASING_OPTIONS.map((opt) => (
                            <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                          ))}
                        </select>
                        <IconButton
                          icon={X}
                          label="Remove control point"
                          size="sm"
                          danger
                          onClick={() => removeEntry(kind.field, i)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  size="sm"
                  icon={Plus}
                  block
                  style={{ marginTop: "var(--space-6)" }}
                  onClick={() => addEntry(kind.field, kind.defaultValue)}
                >
                  Add control point
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Timeline overlay */}
      <TimelineOverlaySection />
    </div>
  );
}

// ---- Timeline Overlay Section ----

function TimelineOverlaySection() {
  const lines = useChartStore((s) => s.chart.lines);
  const selectedLineIndex = useSelectedLineIndex();
  const overlayEnabled = useEditorStore((s) => s.timelineOverlayEnabled);
  const overlayLines = useEditorStore((s) => s.timelineOverlayLines);
  const overlayOpacity = useEditorStore((s) => s.timelineOverlayOpacity);
  const toggleOverlay = useEditorStore((s) => s.toggleTimelineOverlay);
  const toggleOverlayLine = useEditorStore((s) => s.toggleTimelineOverlayLine);
  const setOverlayOpacity = useEditorStore((s) => s.setTimelineOverlayOpacity);

  return (
    <div style={{ marginTop: "var(--space-8)" }}>
      <SectionHeader label="Timeline overlay" />
      <div style={{ padding: "var(--space-4) var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <span style={{ flex: 1, fontSize: "var(--fs-control)", color: "var(--text-primary)" }}>
            Show ghost curves of other lines
          </span>
          <Toggle checked={overlayEnabled} onChange={() => toggleOverlay()} label="Timeline overlay" />
        </div>

        {overlayEnabled && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", minWidth: 42 }}>Opacity</span>
              <input
                type="range"
                aria-label="Overlay opacity"
                min={0} max={1} step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                style={{ flex: 1, cursor: "pointer", accentColor: "var(--accent-primary)" }}
              />
              <span style={{ fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", minWidth: 28, textAlign: "right" }}>
                {Math.round(overlayOpacity * 100)}%
              </span>
            </div>

            <div style={{
              maxHeight: 120, overflowY: "auto",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-active)",
            }}>
              {lines.map((line, idx) => {
                if (idx === selectedLineIndex) return null;
                const isChecked = overlayLines.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    role="checkbox"
                    aria-checked={isChecked}
                    className="ui-hover"
                    onClick={() => toggleOverlayLine(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: "var(--space-6)",
                      width: "100%", padding: "var(--space-4) var(--space-8)",
                      background: isChecked ? "var(--accent-wash)" : undefined,
                      border: "none", borderBottom: "var(--rule) solid var(--separator)",
                      cursor: "pointer", fontFamily: "inherit",
                      fontSize: "var(--fs-caption)", color: isChecked ? "var(--accent-primary)" : "var(--text-secondary)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 12, height: 12, borderRadius: "var(--radius-xs)", flexShrink: 0,
                      border: isChecked ? "none" : "var(--rule) solid var(--border-color)",
                      background: isChecked ? "var(--accent-primary)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--on-accent)",
                    }}>
                      {isChecked && <Icon icon={Check} size={12} />}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {line.name || `Line ${idx}`}
                    </span>
                    <span style={{ fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      {line.notes.length} notes
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
