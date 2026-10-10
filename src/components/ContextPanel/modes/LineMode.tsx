// ============================================================
// LineMode — Context panel content for single-line selection mode
//
// Tabs: events (grouped event lists, X grid, curve editor), props,
// controls, presets, note gen and hotkeys. Fixed X Snap reactivity
// bug in Events tab (was using getState() during render). The
// "Open popout curve editor" button opens the curve editor for the
// current line directly from the ContextPanel.
// ============================================================

import type React from "react";
import { useState, useCallback } from "react";
import { ChevronRight, Copy, Minus, Plus, Spline, SquareDashed, Star, Trash2 } from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectedLineIndex, setEventSelectionByIndex } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { BUILTIN_PRESETS } from "../../../presets/builtinPresets";
import { applyPresetAtPlayhead } from "../../../utils/applyPreset";
import type { LineEventKind, LineEvent, NoteKind } from "../../../types/chart";
import { EVENT_KIND_META, EXTENDED_EVENT_KINDS } from "../../../constants/eventConfig";
import { getEasingLabel, getEventValueSummary, formatBeat } from "../../../utils/eventHelpers";
import { NumericInput } from "../../common/FormFields";
import { Icon } from "../../common/Icon";
import { IconButton } from "../../common/IconButton";
import { NoteGlyph } from "../../common/NoteGlyph";
import { ToolGroup } from "../../common/ToolGroup";
import { SegmentedControl } from "../../common/SegmentedControl";
import { Card, EmptyState, Pill, INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";
import { validateExpression } from "../../../utils/notePatternGenerator";
import { XGridSection } from "../shared/XGridSection";

// ---- Extracted tab components ----
import { ControlsTab } from "./LineModeControlsTab";
import { NoteGenTab } from "./LineModeNoteGenTab";

// ---- Shared sub-components (extracted to shared/) ----
import { HotkeyList, type HotkeySection } from "../shared/HotkeyList";
import { SectionHeader } from "../shared/SectionHeader";
import { ActionButton } from "../shared/ActionButton";
import { ContextBadge } from "../shared/ContextBadge";

// ---- Category options ----

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "(none)" },
  { value: "gameplay", label: "Gameplay" },
  { value: "visual", label: "Visual" },
  { value: "text", label: "Text" },
  { value: "helper", label: "Helper" },
];

// ---- Props ----

export interface LineModeProps {
  activeTab: string;
}

// ---- Main component ----

export function LineMode({ activeTab }: LineModeProps) {
  const activeTool = useEditorStore((s) => s.activeTool);

  // Render content based on tab
  let content: React.ReactNode;
  switch (activeTab) {
    case "events": content = <EventsTab />; break;
    case "props": content = <PropertiesTab />; break;
    case "controls": content = <ControlsTab />; break;
    case "presets": content = <PresetsTab />; break;
    case "note-gen": content = <NoteGenTab />; break;
    case "hotkeys": content = <LineHotkeys />; break;
    default: content = <EventsTab />;
  }

  return (
    <>
      {/* Show pattern config banner when pattern tool is active */}
      {activeTool === "place_pattern" && <PatternConfigBanner />}
      {content}
    </>
  );
}

// ---- Pattern Config Banner — shown when pattern tool is active ----
// Compact inline config for the pattern tool ghost notes

const PATTERN_SHAPES = ["linear", "sine", "cosine", "zigzag", "staircase", "arc", "random", "custom"];
const PATTERN_KINDS: Array<{ value: NoteKind; label: string }> = [
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

/** "zigzag" → "Zigzag" (sentence case for stored lowercase ids). */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function PatternConfigBanner() {
  const config = useEditorStore((s) => s.patternConfig);
  const setConfig = useEditorStore((s) => s.setPatternConfig);
  const expressionError = config.shape === "custom" ? validateExpression(config.expression ?? "") : null;

  return (
    <div style={{
      margin: "0 0 var(--space-6) 0", padding: "var(--space-8) var(--space-10)",
      background: "var(--bg-active)",
      borderRadius: "var(--radius-lg)",
      display: "flex", flexDirection: "column", gap: "var(--space-6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <Icon icon={SquareDashed} size={12} style={{ color: "var(--accent-primary)" }} />
        <span style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)" }}>Pattern</span>
        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
          {config.noteCount} notes · {config.shape}
        </span>
      </div>

      {/* Shape pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {PATTERN_SHAPES.map((s) => (
          <Pill key={s} active={config.shape === s} onClick={() => setConfig({ shape: s })}>
            {sentenceCase(s)}
          </Pill>
        ))}
      </div>

      {/* Count + Kind row */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Count</span>
          <input type="number" value={config.noteCount} min={1} step={1}
            onChange={(e) => setConfig({ noteCount: Math.max(1, parseInt(e.target.value) || 1) })}
            style={{ ...INPUT_STYLE, width: "100%", minWidth: 0, fontFamily: "var(--font-mono)" }}
          />
        </label>
        <ToolGroup label="Pattern note type">
          {PATTERN_KINDS.map((k) => (
            <IconButton
              key={k.value}
              label={k.label}
              size="md"
              active={config.noteKind === k.value}
              onClick={() => setConfig({ noteKind: k.value })}
            >
              <NoteGlyph kind={k.value} size={14} />
            </IconButton>
          ))}
        </ToolGroup>
      </div>

      {/* Expression input — shown when "custom" shape is selected */}
      {config.shape === "custom" && (
        <input
          type="text"
          aria-label="Pattern expression"
          aria-invalid={expressionError ? true : undefined}
          title={expressionError ?? undefined}
          value={config.expression ?? ""}
          onChange={(e) => setConfig({ expression: e.target.value })}
          placeholder="300*sin(2*pi*t)"
          spellCheck={false}
          style={{
            ...INPUT_STYLE,
            width: "100%",
            fontFamily: "var(--font-mono)",
            border: `var(--rule) solid ${expressionError ? "var(--error)" : "var(--success)"}`,
          }}
        />
      )}

      {/* Above/Below */}
      <SegmentedControl
        label="Pattern side"
        tone="accent"
        size="sm"
        block
        options={[{ value: "above", label: "Above" }, { value: "below", label: "Below" }]}
        value={config.above ? "above" : "below"}
        onChange={(v) => setConfig({ above: v === "above" })}
      />
    </div>
  );
}

// ---- Events sub-tab ----

function EventsTab() {
  const selectedLineIndex = useSelectedLineIndex();
  // xSnapEnabled and verticalLines are handled by XGridSection internally
  const lines = useChartStore((s) => s.chart.lines);
  const addEvent = useChartStore((s) => s.addEvent);

  if (selectedLineIndex === null) return null;
  const line = lines[selectedLineIndex];
  if (!line) return null;

  const noteCount = line.notes.length;

  // Group events by kind, tracking their real index in line.events
  // so we can select the correct event when clicked
  const eventsByKind: Record<string, Array<{ event: LineEvent; realIndex: number }>> = {};
  for (let i = 0; i < line.events.length; i++) {
    const ev = line.events[i];
    if (!eventsByKind[ev.kind]) eventsByKind[ev.kind] = [];
    eventsByKind[ev.kind].push({ event: ev, realIndex: i });
  }

  const coreKinds: LineEventKind[] = ["x", "y", "rotation", "opacity", "speed"];

  // Count extended events (for the section header badge)
  const extendedEventCount = line.events.filter((ev) =>
    EXTENDED_EVENT_KINDS.includes(ev.kind as LineEventKind),
  ).length;

  const handleAddEvent = (kind: LineEventKind) => {
    addEvent(selectedLineIndex, {
      kind,
      start_beat: [0, 0, 1],
      end_beat: [4, 0, 1],
      value: { constant: kind === "opacity" ? 255 : kind === "speed" ? 1 : 0 },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <ContextBadge
        icon={Minus}
        label={line.name}
        detail={`${noteCount} notes · ${line.events.length} events`}
        variant="line"
      />

      {/* Core event groups — each event row is clickable to enter Event edit mode */}
      {coreKinds.map((kind) => {
        const config = EVENT_KIND_META[kind];
        const entries = eventsByKind[kind] ?? [];
        return (
          <EventGroup
            key={kind}
            kind={kind}
            color={config.color}
            label={config.label}
            entries={entries}
            onAdd={() => handleAddEvent(kind)}
          />
        );
      })}

      {/* Extended events — same clickable pattern as core events */}
      <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <SectionHeader label="Extended events" count={extendedEventCount} />
        {EXTENDED_EVENT_KINDS.map((kind) => {
          const config = EVENT_KIND_META[kind];
          const entries = eventsByKind[kind] ?? [];
          if (entries.length === 0) return null;
          return (
            <EventGroup
              key={kind}
              kind={kind}
              color={config.color}
              label={config.label}
              entries={entries}
              onAdd={() => handleAddEvent(kind)}
            />
          );
        })}
        {extendedEventCount === 0 && (
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", padding: "var(--space-4) var(--space-8)" }}>
            No extended events. Add scale, color, text, incline, or GIF events from the timeline.
          </div>
        )}
      </div>

      {/* X grid — shared toggle, presets, and status indicator */}
      <SectionHeader label="X grid" />
      <XGridSection />

      {/* Curve editor — open the popout curve editor for this line's events */}
      <SectionHeader label="Curve editor" />
      <ActionButton
        icon={Spline}
        label="Open popout curve editor"
        onClick={() => {
          // Toggle the popout curve editor. It reads selectedLineIndex from editorStore
          // and renders event curves for the current line in a separate window.
          useEditorStore.getState().setCurveEditorPoppedOut(true);
        }}
      />
    </div>
  );
}

// ---- Event group row ----
// Each event row is clickable: clicking selects the event in editorStore,
// which triggers useContextPanelMode() to return "event", auto-switching
// the panel to EventMode where the user can edit timing, value, and easing.

function EventGroup({ color, label, entries, onAdd }: {
  kind?: LineEventKind;
  color: string;
  label: string;
  entries: Array<{ event: LineEvent; realIndex: number }>;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(entries.length <= 5);

  // Clicking an event row selects it, which auto-switches to Event mode
  const handleEventClick = useCallback((realIndex: number) => {
    setEventSelectionByIndex([realIndex]);
  }, []);

  return (
    <div style={{ borderRadius: "var(--radius-xl)", background: "var(--bg-active)", overflow: "hidden" }}>
      {/* Group header — click to expand/collapse */}
      <div
        className="ui-hover"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-4) var(--space-6) var(--space-4) var(--space-10)",
          cursor: "pointer",
          borderBottom: expanded && entries.length > 0 ? "var(--rule) solid var(--separator)" : "none",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{label}</span>
        <span style={{
          fontSize: "var(--fs-badge)", fontWeight: 600, lineHeight: "12px", color: "var(--text-secondary)",
          padding: "1px var(--space-6)", borderRadius: "var(--radius-full)", background: "var(--bg-tertiary)",
        }}>
          {entries.length}
        </span>
        <IconButton
          icon={Plus}
          label={`Add ${label} event`}
          size="sm"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
        />
        <Icon
          icon={ChevronRight}
          size={12}
          style={{ color: "var(--text-secondary)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform var(--dur-fast)" }}
        />
      </div>

      {/* Event list — each row clickable to enter Event edit mode */}
      {expanded && entries.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: "auto" }}>
          {entries.map(({ event: ev, realIndex }, i) => (
            <div
              key={realIndex}
              className="ui-hover"
              onClick={() => handleEventClick(realIndex)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-6)",
                padding: "var(--space-4) var(--space-8) var(--space-4) var(--space-14)",
                fontSize: "var(--fs-caption)", color: "var(--text-secondary)",
                cursor: "pointer",
                borderBottom: i < entries.length - 1 ? "var(--rule) solid var(--separator)" : "none",
              }}
            >
              {/* Colored dot matching the event kind */}
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: color, flexShrink: 0,
              }} />
              {/* Beat range */}
              <span style={{
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)", minWidth: 52,
              }}>
                {formatBeat(ev.start_beat)}–{formatBeat(ev.end_beat)}
              </span>
              {/* Value summary */}
              <span style={{
                flex: 1, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
              }}>
                {getEventValueSummary(ev)}
              </span>
              {/* Easing chip */}
              <span style={{
                fontSize: "var(--fs-caption)", padding: "0 var(--space-4)", borderRadius: "var(--radius-xs)",
                background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
              }}>
                {getEasingLabel(ev)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Properties sub-tab ----

const FIELD_INPUT: React.CSSProperties = { ...INPUT_STYLE, width: "100%" };
const FIELD_NUMBER: React.CSSProperties = { ...FIELD_INPUT, fontFamily: "var(--font-mono)" };

const FIELD_LABEL: React.CSSProperties = {
  fontSize: "var(--fs-caption)", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "var(--space-2)",
};

const FIELD_ROW: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "var(--space-2)",
};

const CHECK_ROW: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-2) 0",
  fontSize: "var(--fs-caption)", color: "var(--text-secondary)", cursor: "pointer",
};

const FIELD_GROUP: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "var(--space-8)", padding: "0 var(--space-4)",
};

function PropertiesTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const lines = useChartStore((s) => s.chart.lines);
  const editLine = useChartStore((s) => s.editLine);
  const duplicateLine = useChartStore((s) => s.duplicateLine);
  const removeLine = useChartStore((s) => s.removeLine);
  const selectLine = useEditorStore((s) => s.selectLine);

  if (selectedLineIndex === null) return null;
  const line = lines[selectedLineIndex];
  if (!line) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    editLine(selectedLineIndex, { name: e.target.value });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || undefined;
    editLine(selectedLineIndex, { _category: val as any });
  };

  const handleZOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) editLine(selectedLineIndex, { z_order: val });
  };

  const handleDelete = () => {
    removeLine(selectedLineIndex);
    selectLine(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
      {/* Identity section */}
      <SectionHeader label="Identity" />
      <div style={FIELD_GROUP}>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Name</span>
          <input style={FIELD_INPUT} value={line.name} onChange={handleNameChange} />
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Category</span>
          <select style={{ ...SELECT_STYLE, width: "100%" }} value={line._category ?? ""} onChange={handleCategoryChange}>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Z-order</span>
          <input
            style={FIELD_NUMBER}
            type="number"
            value={line.z_order ?? 0}
            onChange={handleZOrderChange}
          />
        </label>
      </div>

      {/* Hierarchy section */}
      <SectionHeader label="Hierarchy" />
      <div style={FIELD_GROUP}>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Parent</span>
          <input
            style={FIELD_NUMBER}
            type="number"
            placeholder="Line index (-1 = none)"
            value={line.father_index ?? -1}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) editLine(selectedLineIndex, { father_index: val });
            }}
          />
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Group</span>
          <input
            style={FIELD_NUMBER}
            type="number"
            placeholder="Group index"
            value={line.group ?? 0}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) editLine(selectedLineIndex, { group: val });
            }}
          />
        </label>
        <label style={CHECK_ROW}>
          <input
            type="checkbox"
            checked={line.rotate_with_father !== false}
            onChange={(e) => editLine(selectedLineIndex, { rotate_with_father: e.target.checked })}
            style={{ accentColor: "var(--accent-primary)" }}
          />
          Inherit parent rotation
        </label>
      </div>

      {/* Texture section */}
      <SectionHeader label="Texture" />
      <div style={FIELD_GROUP}>
        {line.texture ? (
          <div style={{
            fontSize: "var(--fs-caption)", color: "var(--text-primary)", padding: "var(--space-4) var(--space-8)",
            background: "var(--bg-active)", borderRadius: "var(--radius-md)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {line.texture}
          </div>
        ) : (
          <div style={{
            fontSize: "var(--fs-caption)", color: "var(--text-secondary)", padding: "var(--space-6)", textAlign: "center",
            background: "var(--bg-active)", borderRadius: "var(--radius-md)",
          }}>
            No texture assigned
          </div>
        )}
        <div style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Anchor</span>
          {/* Anchor X/Y — can be 0 or negative for offset pivots */}
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <NumericInput
              style={{ ...FIELD_NUMBER, flex: 1 }}
              step="0.1"
              placeholder="X (0.5)"
              title="Anchor X"
              value={line.anchor?.[0] ?? 0.5}
              onChange={(val) => editLine(selectedLineIndex, { anchor: [val, line.anchor?.[1] ?? 0.5] })}
            />
            <NumericInput
              style={{ ...FIELD_NUMBER, flex: 1 }}
              step="0.1"
              placeholder="Y (0.5)"
              title="Anchor Y"
              value={line.anchor?.[1] ?? 0.5}
              onChange={(val) => editLine(selectedLineIndex, { anchor: [line.anchor?.[0] ?? 0.5, val] })}
            />
          </div>
        </div>
      </div>

      {/* Advanced section */}
      <SectionHeader label="Advanced" />
      <div style={FIELD_GROUP}>
        <label style={FIELD_ROW}>
          {/* BPM factor — must be > 0, but allow intermediate typing (e.g. "0.5") */}
          <span style={FIELD_LABEL}>BPM factor</span>
          <NumericInput
            style={FIELD_NUMBER}
            step="0.1"
            value={line.bpm_factor ?? 1}
            onChange={(val) => {
              // BPM factor domain: strictly positive (> 0)
              if (val > 0) editLine(selectedLineIndex, { bpm_factor: val });
            }}
          />
        </label>
        <label style={CHECK_ROW}>
          <input
            type="checkbox"
            checked={line.is_cover !== false}
            onChange={(e) => editLine(selectedLineIndex, { is_cover: e.target.checked })}
            style={{ accentColor: "var(--accent-primary)" }}
          />
          Is cover (occlude passed notes)
        </label>
        <label style={FIELD_ROW}>
          <span style={FIELD_LABEL}>Attach UI</span>
          <input
            style={FIELD_INPUT}
            placeholder="e.g. combo, score, bar"
            value={line.attach_ui ?? ""}
            onChange={(e) => editLine(selectedLineIndex, { attach_ui: e.target.value || undefined })}
          />
        </label>
      </div>

      {/* Danger section */}
      <SectionHeader label="Danger zone" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 var(--space-4)" }}>
        <ActionButton icon={Copy} label="Duplicate line" onClick={() => duplicateLine(selectedLineIndex)} />
        <ActionButton icon={Trash2} label="Delete line" danger onClick={handleDelete} />
      </div>
    </div>
  );
}

// ControlsTab extracted to LineModeControlsTab.tsx
// NoteGenTab extracted to LineModeNoteGenTab.tsx

// ---- Presets sub-tab ----

function PresetsTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const [search, setSearch] = useState("");
  const favoritePresetIds = useFavoritesStore((s) => s.favoritePresetIds);
  const toggleFavoritePreset = useFavoritesStore((s) => s.toggleFavoritePreset);

  if (selectedLineIndex === null) return null;

  const normalizedSearch = search.toLowerCase().trim();
  const filteredPresets = BUILTIN_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(normalizedSearch) ||
      p.description.toLowerCase().includes(normalizedSearch) ||
      (p.category ?? "").toLowerCase().includes(normalizedSearch),
  );

  // Sort: favorites first
  const sortedPresets = [...filteredPresets].sort((a, b) => {
    const aFav = favoritePresetIds.includes(a.id) ? 0 : 1;
    const bFav = favoritePresetIds.includes(b.id) ? 0 : 1;
    return aFav - bFav;
  });

  const handleApply = (presetId: string) => {
    const preset = BUILTIN_PRESETS.find((p) => p.id === presetId);
    if (preset) applyPresetAtPlayhead(selectedLineIndex, preset);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Search */}
      <input
        placeholder="Search presets…"
        aria-label="Search presets"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...INPUT_STYLE, width: "100%", height: "var(--control-lg)" }}
      />

      {/* Preset list — click a row to apply at the playhead */}
      {sortedPresets.length > 0 && (
        <Card>
          {sortedPresets.map((preset, i) => {
            const isFav = favoritePresetIds.includes(preset.id);
            return (
              <div
                key={preset.id}
                className="ui-hover"
                onClick={() => handleApply(preset.id)}
                style={{
                  display: "flex", flexDirection: "column", gap: "var(--space-2)",
                  padding: "var(--space-6) var(--space-6) var(--space-6) var(--space-10)", cursor: "pointer",
                  borderBottom: i < sortedPresets.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                  <span style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                    {preset.name}
                  </span>
                  <IconButton
                    label={isFav ? "Remove from favorites" : "Add to favorites"}
                    size="sm"
                    active={isFav}
                    onClick={(e) => { e.stopPropagation(); toggleFavoritePreset(preset.id); }}
                  >
                    <Icon icon={Star} size={12} fill={isFav ? "currentColor" : "none"} />
                  </IconButton>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                  {preset.category && (
                    <span style={{
                      fontSize: "var(--fs-badge)", fontWeight: 600, lineHeight: "12px", padding: "1px var(--space-6)",
                      borderRadius: "var(--radius-full)", background: "var(--bg-tertiary)", color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}>
                      {sentenceCase(preset.category)}
                    </span>
                  )}
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                    {preset.description}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {filteredPresets.length === 0 && (
        <EmptyState>No presets match your search.</EmptyState>
      )}
    </div>
  );
}

// ---- Hotkeys sub-tab ----

const LINE_HOTKEY_SECTIONS: HotkeySection[] = [
  {
    title: "Line editing",
    keys: [
      { label: "New line", hotkey: "Ctrl+N" },
      { label: "Duplicate", hotkey: "Ctrl+D" },
      { label: "Delete line", hotkey: "Ctrl+Del" },
      { label: "Rename", hotkey: "F2" },
      { label: "Move up", hotkey: "Alt+Up" },
      { label: "Move down", hotkey: "Alt+Down" },
    ],
  },
  {
    title: "Event editing",
    keys: [
      { label: "Insert event", hotkey: "I" },
      { label: "Split at beat", hotkey: "S" },
      { label: "Merge events", hotkey: "M" },
      { label: "Fill gaps", hotkey: "F" },
      { label: "Apply preset", hotkey: "P" },
      { label: "Lock value", hotkey: "L" },
    ],
  },
  {
    title: "Note placement",
    keys: [
      { label: "Tap", hotkey: "1" },
      { label: "Drag", hotkey: "2" },
      { label: "Flick", hotkey: "3" },
      { label: "Hold", hotkey: "4" },
      { label: "Toggle above", hotkey: "T" },
      { label: "Toggle below", hotkey: "B" },
    ],
  },
];

function LineHotkeys() {
  return <HotkeyList sections={LINE_HOTKEY_SECTIONS} />;
}
