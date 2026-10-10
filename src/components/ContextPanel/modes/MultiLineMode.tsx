// ============================================================
// MultiLineMode — Context panel content for multi-line selection mode
// ============================================================

import type React from "react";
import { useState, useCallback } from "react";
import { Copy, Gauge, Layers, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { useMultiSelectedLineIndices } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { BUILTIN_PRESETS } from "../../../presets/builtinPresets";
import { applyPresetAtPlayhead } from "../../../utils/applyPreset";
import { BatchOffsetEditor } from "../batch/BatchOffsetEditor";
import { INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";

// ---- Shared sub-components (extracted to shared/) ----
import { HotkeyList, type HotkeySection } from "../shared/HotkeyList";
import { SectionHeader } from "../shared/SectionHeader";
import { ActionButton } from "../shared/ActionButton";
import { ContextBadge } from "../shared/ContextBadge";

// ---- Shared styles ----

const FIELD_INPUT: React.CSSProperties = { ...INPUT_STYLE, width: "100%" };
const FIELD_NUMBER: React.CSSProperties = { ...FIELD_INPUT, fontFamily: "var(--font-mono)" };
const FIELD_ROW: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "var(--space-2)" };
const FIELD_LABEL: React.CSSProperties = {
  fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)",
};

/** "gameplay" → "Gameplay" (sentence case for stored lowercase ids). */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- Props ----

export interface MultiLineModeProps {
  activeTab: string;
}

// ---- Main component ----

export function MultiLineMode({ activeTab }: MultiLineModeProps) {
  switch (activeTab) {
    case "batch": return <BatchOpsTab />;
    case "offset": return <BatchOffsetTab />;
    case "hotkeys": return <MultiLineHotkeys />;
    default: return <BatchOpsTab />;
  }
}

// ---- Batch Ops sub-tab ----

function BatchOpsTab() {
  const multiSelectedLineIndices = useMultiSelectedLineIndices();
  const lines = useChartStore((s) => s.chart.lines);
  const duplicateLine = useChartStore((s) => s.duplicateLine);
  const removeLine = useChartStore((s) => s.removeLine);
  const editLine = useChartStore((s) => s.editLine);
  // Routed add (finding L3): batch fades land in the active layer on layered
  // lines so they're visible + exported. transaction (finding L1): one undo
  // entry per batch instead of one per line.
  const addEventRouted = useChartStore((s) => s.addEventRouted);
  const transaction = useChartStore((s) => s.transaction);
  const clearMultiSelectedLines = useEditorStore((s) => s.clearMultiSelectedLines);

  const [presetSearch, setPresetSearch] = useState("");

  const selectedLines = multiSelectedLineIndices
    .filter((i) => i < lines.length)
    .map((i) => ({ line: lines[i], index: i }));

  const totalNotes = selectedLines.reduce((acc, { line }) => acc + line.notes.length, 0);

  const handleDeleteAll = useCallback(() => {
    const sorted = [...multiSelectedLineIndices].sort((a, b) => b - a);
    for (const idx of sorted) {
      removeLine(idx);
    }
    clearMultiSelectedLines();
  }, [multiSelectedLineIndices, removeLine, clearMultiSelectedLines]);

  const handleDuplicateAll = useCallback(() => {
    for (const idx of multiSelectedLineIndices) {
      duplicateLine(idx);
    }
  }, [multiSelectedLineIndices, duplicateLine]);

  const handleSetCategory = useCallback((category: string) => {
    for (const idx of multiSelectedLineIndices) {
      editLine(idx, { _category: (category || undefined) as any });
    }
  }, [multiSelectedLineIndices, editLine]);

  const handleSetGroup = useCallback((group: number) => {
    for (const idx of multiSelectedLineIndices) {
      editLine(idx, { group });
    }
  }, [multiSelectedLineIndices, editLine]);

  const handleSetParent = useCallback((parentIndex: number) => {
    for (const idx of multiSelectedLineIndices) {
      editLine(idx, { father_index: parentIndex });
    }
  }, [multiSelectedLineIndices, editLine]);

  const handleBatchFadeIn = useCallback(() => {
    transaction(() => {
      for (const { index } of selectedLines) {
        addEventRouted(index, {
          kind: "opacity",
          start_beat: [0, 0, 1],
          end_beat: [2, 0, 1],
          value: { transition: { start: 0, end: 255, easing: "ease_out_sine" } },
        });
      }
    });
  }, [selectedLines, addEventRouted, transaction]);

  const handleBatchFadeOut = useCallback(() => {
    transaction(() => {
      for (const { index } of selectedLines) {
        addEventRouted(index, {
          kind: "opacity",
          start_beat: [0, 0, 1],
          end_beat: [2, 0, 1],
          value: { transition: { start: 255, end: 0, easing: "ease_in_sine" } },
        });
      }
    });
  }, [selectedLines, addEventRouted, transaction]);

  const handleSyncSpeed = useCallback(() => {
    // Set the base speed to a constant 1 at beat 0. Short span (not [0,1000]):
    // a constant holds its value via inheritance for all later beats, so this
    // sets the line's initial speed without planting a baseline that would
    // shadow real speed automation under the value-tiebreak (finding L4). Lines
    // with their own speed events keep them (Affecting outranks this Inherited
    // value past beat 1).
    transaction(() => {
      for (const { index } of selectedLines) {
        addEventRouted(index, {
          kind: "speed",
          start_beat: [0, 0, 1],
          end_beat: [1, 0, 1],
          value: { constant: 1 },
        });
      }
    });
  }, [selectedLines, addEventRouted, transaction]);

  // Filter presets for batch apply
  const normalizedSearch = presetSearch.toLowerCase().trim();
  const filteredPresets = normalizedSearch
    ? BUILTIN_PRESETS.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedSearch) ||
          (p.category ?? "").toLowerCase().includes(normalizedSearch),
      ).slice(0, 6)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Context badge */}
      <ContextBadge
        icon={Layers}
        label={`${selectedLines.length} lines selected`}
        detail={`${totalNotes} notes in total`}
        variant="line"
      />

      {/* Selected lines list */}
      <SectionHeader label="Selected lines" count={selectedLines.length} />
      <div style={{ maxHeight: 140, overflowY: "auto", borderRadius: "var(--radius-xl)", background: "var(--bg-active)" }}>
        {selectedLines.map(({ line, index }, i) => (
          <div
            key={index}
            style={{
              display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-4) var(--space-10)",
              fontSize: "var(--fs-caption)",
              borderBottom: i < selectedLines.length - 1 ? "var(--rule) solid var(--separator)" : "none",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", minWidth: 20, textAlign: "right" }}>
              #{index}
            </span>
            <span style={{ color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</span>
            <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{line.notes.length} notes</span>
            {line._category && (
              <span style={{
                fontSize: "var(--fs-badge)", fontWeight: 600, lineHeight: "12px", padding: "1px var(--space-6)",
                borderRadius: "var(--radius-full)", background: "var(--bg-tertiary)", color: "var(--text-secondary)",
              }}>
                {sentenceCase(line._category)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Batch operations */}
      <SectionHeader label="Batch properties" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", padding: "0 var(--space-4)" }}>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Set parent (line index)</span>
          <input
            style={FIELD_NUMBER}
            type="number"
            placeholder="-1 = none"
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) handleSetParent(val);
            }}
          />
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Move to group</span>
          <input
            style={FIELD_NUMBER}
            type="number"
            placeholder="Group index"
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) handleSetGroup(val);
            }}
          />
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Set category</span>
          <select
            style={{ ...SELECT_STYLE, width: "100%" }}
            onChange={(e) => handleSetCategory(e.target.value)}
          >
            <option value="">Choose…</option>
            <option value="">None</option>
            <option value="gameplay">Gameplay</option>
            <option value="visual">Visual</option>
            <option value="text">Text</option>
            <option value="helper">Helper</option>
          </select>
        </label>
        <div style={FIELD_ROW}>
          <label htmlFor="multi-line-preset-search" style={FIELD_LABEL}>Apply preset</label>
          <input
            id="multi-line-preset-search"
            style={FIELD_INPUT}
            placeholder="Search presets…"
            value={presetSearch}
            onChange={(e) => setPresetSearch(e.target.value)}
          />
          {filteredPresets.length > 0 && (
            <div style={{ marginTop: "var(--space-4)", borderRadius: "var(--radius-lg)", background: "var(--bg-active)", overflow: "hidden" }}>
              {filteredPresets.map((preset, i) => (
                <button
                  key={preset.id}
                  type="button"
                  className="ui-hover"
                  onClick={() => {
                    for (const { index } of selectedLines) {
                      applyPresetAtPlayhead(index, preset);
                    }
                    setPresetSearch("");
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-6)", width: "100%",
                    padding: "var(--space-4) var(--space-8)", minHeight: "var(--control-md)",
                    border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    borderBottom: i < filteredPresets.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                    fontSize: "var(--fs-caption)", color: "var(--text-secondary)",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{preset.name}</span>
                  {preset.category && (
                    <span style={{ marginLeft: "auto" }}>{sentenceCase(preset.category)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch events */}
      <SectionHeader label="Batch events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <ActionButton icon={TrendingUp} label="Fade in all (opacity 0 to 255)" onClick={handleBatchFadeIn} />
        <ActionButton icon={TrendingDown} label="Fade out all (opacity 255 to 0)" onClick={handleBatchFadeOut} />
        <ActionButton icon={Gauge} label="Sync speed (constant 1)" onClick={handleSyncSpeed} />
      </div>

      {/* Danger zone */}
      <SectionHeader label="Danger zone" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <ActionButton icon={Copy} label={`Duplicate all ${selectedLines.length} lines`} onClick={handleDuplicateAll} />
        <ActionButton icon={Trash2} label={`Delete all ${selectedLines.length} lines`} danger onClick={handleDeleteAll} />
      </div>
    </div>
  );
}

// ---- Batch Offset sub-tab ----

function BatchOffsetTab() {
  return <BatchOffsetEditor />;
}

// ---- Hotkeys sub-tab ----

const MULTI_HOTKEY_SECTIONS: HotkeySection[] = [
  {
    title: "Multi-line selection",
    keys: [
      { label: "Add to selection", hotkey: "Shift+Click" },
      { label: "Select all", hotkey: "Ctrl+A" },
      { label: "Deselect", hotkey: "Esc" },
      { label: "Group selection", hotkey: "Ctrl+G" },
      { label: "Ungroup", hotkey: "Ctrl+U" },
      { label: "Invert selection", hotkey: "Ctrl+I" },
    ],
  },
  {
    title: "Batch operations",
    keys: [
      { label: "Duplicate all", hotkey: "Ctrl+D" },
      { label: "Delete all", hotkey: "Ctrl+Del" },
      { label: "Set category", hotkey: "Ctrl+Shift+C" },
      { label: "Set parent", hotkey: "Ctrl+Shift+P" },
      { label: "Move to group", hotkey: "Ctrl+Shift+M" },
      { label: "Apply preset", hotkey: "Ctrl+Shift+A" },
    ],
  },
  {
    title: "Alignment",
    keys: [
      { label: "Align Y", hotkey: "Alt+Up/Down" },
      { label: "Align X", hotkey: "Alt+Left/Right" },
      { label: "Center", hotkey: "Alt+C" },
      { label: "Flip order", hotkey: "Alt+F" },
      { label: "Distribute", hotkey: "Alt+D" },
      { label: "Rotate arrangement", hotkey: "Alt+R" },
    ],
  },
];

function MultiLineHotkeys() {
  return <HotkeyList sections={MULTI_HOTKEY_SECTIONS} />;
}
