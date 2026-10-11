// ============================================================
// GlobalMode — Context panel content for global (no selection) mode
//
// Sections: tools / playback / edit / file tool groups, quick actions,
// section markers, select by range, X grid, beat grid, display
// (spectrogram, onsets, note side filter), record channels, timeline
// zoom, line sort & filter, and inline panels. Fixed X Snap
// reactivity bug.
// ============================================================

import type React from "react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  MousePointer2, Eraser, Play, Square, Rewind, SkipBack, SkipForward, Circle,
  Scissors, Copy, ClipboardPaste, Undo2, Redo2, SquareDashedMousePointer,
  FolderOpen, Save, Upload, FileInput, Settings, CircleHelp,
  Music, Folder, Image, CircleCheck, Star, CircleDashed,
  Plus, Rows3, MicVocal, Spline, BookmarkPlus, ChevronLeft, LocateFixed,
} from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { getSelectedLineIndex, setNoteSelectionByIndex, useSelectedLineIndex } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { useAudioStore } from "../../../stores/audioStore";
import { useDialogStore } from "../../../stores/dialogStore";
import { audioEngine } from "../../../audio/audioEngine";
import { triggerImportChart } from "../../../utils/importChart";
import { saveProject } from "../../../utils/ipc";
import { useContextPanelStore } from "../../../stores/contextPanelStore";
import { seekToPrevBookmark, seekToNextBookmark, addMarkerAtCurrentBeat } from "../../../utils/bookmarkNavigation";
import { useBookmarkStore } from "../../../stores/bookmarkStore";
import { performCopy, performCut, performPaste } from "../../../hooks/useClipboard";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useToastStore } from "../../../stores/toastStore";
import { selectByRange } from "../../../utils/batchNoteOps";
import { getPlayheadBeat } from "../../../utils/playhead";
import type { EditorTool, LineSortMode, NoteSideFilter } from "../../../types/editor";
import type { NoteKind } from "../../../types/chart";

// Panel components rendered inline when a panel button is clicked
import { ChartSettings } from "../../ChartSettings/ChartSettings";
import { BpmListPanel } from "../../BpmList/BpmList";
import { GroupManager } from "../../GroupManager/GroupManager";
import { TexturePanel } from "../../TexturePanel/TexturePanel";
import { ValidationPanel } from "../../Validation/ValidationPanel";
import { PresetPanel } from "../../PresetPanel/PresetPanel";

// ---- Design system primitives ----
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { IconButton } from "../../common/IconButton";
import { NoteGlyph } from "../../common/NoteGlyph";
import { ToolGroup } from "../../common/ToolGroup";
import { Button } from "../../common/Button";
import { SegmentedControl } from "../../common/SegmentedControl";
import { Badge, Pill, Toggle, INPUT_STYLE } from "../../common/UIKit";

// ---- Shared sub-components (extracted to shared/) ----
import { HotkeyButton } from "../shared/HotkeyButton";
import { HotkeyList, type HotkeySection } from "../shared/HotkeyList";
import type { ShortcutRef } from "../../../hooks/useHotkeyLabel";
import { SectionHeader } from "../shared/SectionHeader";
import { ActionButton } from "../shared/ActionButton";
import { ContextBadge } from "../shared/ContextBadge";
import { XGridSection } from "../shared/XGridSection";

// ---- Shared styles ----

/** Caption label in front of a control row. */
const CAPTION: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--text-secondary)",
};

/** Mono numeric readout after a slider. */
const READOUT: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  fontFamily: "var(--font-mono)",
  color: "var(--text-secondary)",
  minWidth: 32,
  textAlign: "right",
};

const SLIDER: React.CSSProperties = { flex: 1, minWidth: 0, accentColor: "var(--accent-primary)" };

const ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: "var(--space-6)" };

// ---- Tool group data ----

// Selection tools use a Lucide icon; note tools show their NoteGlyph.
// Hotkeys are registry actions, so they show the binding from Settings > Hotkeys.
const TOOL_BUTTONS: Array<{ label: string; hotkey: ShortcutRef; tool: EditorTool; icon?: LucideIcon; note?: NoteKind }> = [
  { icon: MousePointer2, label: "Select", hotkey: { action: "select_tool" }, tool: "select" },
  { icon: Eraser, label: "Eraser", hotkey: { action: "eraser_tool" }, tool: "eraser" },
  { note: "tap", label: "Tap", hotkey: { action: "place_tap" }, tool: "place_tap" },
  { note: "drag", label: "Drag", hotkey: { action: "place_drag" }, tool: "place_drag" },
  { note: "flick", label: "Flick", hotkey: { action: "place_flick" }, tool: "place_flick" },
  { note: "hold", label: "Hold", hotkey: { action: "place_hold" }, tool: "place_hold" },
];

// Button arrays with action callbacks. Every hotkey shown is really bound:
// `{ action }` entries follow Settings > Hotkeys, strings are fixed bindings,
// "" means no shortcut.

interface ActionButtonDef { icon: LucideIcon; label: string; hotkey: ShortcutRef; action: () => void }

const PLAYBACK_BUTTONS: ActionButtonDef[] = [
  { icon: Play, label: "Play", hotkey: { action: "toggle_playback" }, action: () => useAudioStore.getState().togglePlayPause() },
  { icon: Square, label: "Stop", hotkey: "", action: () => audioEngine.stop() },
  { icon: Rewind, label: "Rewind to start", hotkey: "", action: () => useAudioStore.getState().seek(0) },
  { icon: SkipBack, label: "Previous marker", hotkey: { action: "prev_marker" }, action: () => seekToPrevBookmark() },
  { icon: SkipForward, label: "Next marker", hotkey: { action: "next_marker" }, action: () => seekToNextBookmark() },
  { icon: Circle, label: "Record", hotkey: "Alt+R", action: () => useEditorStore.getState().toggleRecordMode() },
];

const EDIT_BUTTONS: ActionButtonDef[] = [
  { icon: Scissors, label: "Cut", hotkey: "Ctrl+X", action: () => performCut() },
  { icon: Copy, label: "Copy", hotkey: "Ctrl+C", action: () => performCopy() },
  { icon: ClipboardPaste, label: "Paste", hotkey: "Ctrl+V", action: () => performPaste() },
  { icon: Undo2, label: "Undo", hotkey: { action: "undo" }, action: () => {
    // Interleaved undo: compare sequence numbers to decide which store to undo
    const cs = useChartStore.getState();
    const bs = useBookmarkStore.getState();
    const chartTopSeq = cs._pastSeqs.length > 0 ? cs._pastSeqs[cs._pastSeqs.length - 1] : 0;
    const bmTopSeq = bs._pastSeqs.length > 0 ? bs._pastSeqs[bs._pastSeqs.length - 1] : 0;
    if (bmTopSeq > chartTopSeq && bs.canUndo()) { bs.undo(); } else { cs.undo(); }
  }},
  { icon: Redo2, label: "Redo", hotkey: { action: "redo" }, action: () => {
    const cs = useChartStore.getState();
    const bs = useBookmarkStore.getState();
    const chartRedoSeq = cs._futureSeqs.length > 0 ? cs._futureSeqs[cs._futureSeqs.length - 1] : 0;
    const bmRedoSeq = bs._futureSeqs.length > 0 ? bs._futureSeqs[bs._futureSeqs.length - 1] : 0;
    if (bmRedoSeq > chartRedoSeq && bs.canRedo()) { bs.redo(); } else { cs.redo(); }
  }},
  { icon: SquareDashedMousePointer, label: "Select all notes", hotkey: { action: "select_all" }, action: () => {
    const lineIdx = getSelectedLineIndex();
    if (lineIdx === null) return;
    const notes = useChartStore.getState().chart.lines[lineIdx]?.notes;
    if (notes) setNoteSelectionByIndex([...Array(notes.length).keys()]);
  }},
];

const FILE_BUTTONS: ActionButtonDef[] = [
  { icon: FolderOpen, label: "Open", hotkey: "Ctrl+O", action: () => triggerImportChart() },
  { icon: Save, label: "Save", hotkey: { action: "save" }, action: async () => {
    const cs = useChartStore.getState();
    if (!cs.projectPath) return;
    const token = cs._dirtySeq; // F2: capture before the async write (see markCleanIf)
    try {
      await saveProject(cs.projectPath, cs.getChartJson(), JSON.stringify(cs.meta));
      cs.markCleanIf(token);
    } catch (e) {
      console.error("Save failed:", e);
    }
  }},
  { icon: Upload, label: "Export…", hotkey: "", action: () => useDialogStore.getState().openDialog("selective-export") },
  { icon: FileInput, label: "Import", hotkey: "Ctrl+O", action: () => triggerImportChart() },
  { icon: Settings, label: "Settings…", hotkey: "", action: () => useDialogStore.getState().openDialog("settings") },
  { icon: CircleHelp, label: "Help", hotkey: "", action: () => {
    // Switch to hotkeys tab within the context panel
    useContextPanelStore.getState().setActiveTab("global", "hotkeys");
  }},
];

// ---- Panel list data ----

// Panel items — panelId maps to INLINE_PANELS keys for inline rendering
const PANEL_ITEMS: Array<{ icon: LucideIcon; label: string; panelId: string }> = [
  { icon: Settings, label: "Chart settings", panelId: "chart-settings" },
  { icon: Music, label: "BPM list", panelId: "bpm-list" },
  { icon: Folder, label: "Groups", panelId: "groups" },
  { icon: Image, label: "Textures", panelId: "textures" },
  { icon: CircleCheck, label: "Validation", panelId: "validation" },
  { icon: Star, label: "Presets", panelId: "presets" },
];

// ---- Inline panel registry ----
// Maps panel IDs to their React component for inline rendering in the context panel
const INLINE_PANELS: Record<string, { label: string; component: React.ComponentType }> = {
  "chart-settings": { label: "Chart settings", component: ChartSettings },
  "bpm-list": { label: "BPM list", component: BpmListPanel },
  "groups": { label: "Groups", component: GroupManager },
  "textures": { label: "Textures", component: TexturePanel },
  "validation": { label: "Validation", component: ValidationPanel },
  "presets": { label: "Presets", component: PresetPanel },
};

const SIDE_OPTIONS: Array<{ value: NoteSideFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
];

const ZOOM_PRESETS = [0.5, 1, 2, 4] as const;

const SORT_OPTIONS: Array<{ value: LineSortMode; label: string; title: string }> = [
  { value: "chart_order", label: "Chart", title: "Chart order" },
  { value: "first_appearance", label: "Appear", title: "First appearance" },
  { value: "active_first", label: "Active", title: "Active first" },
];

const LINE_CATEGORIES = [
  { value: "gameplay", label: "Gameplay" },
  { value: "visual", label: "Visual" },
  { value: "text", label: "Text" },
  { value: "helper", label: "Helper" },
] as const;

const RECORD_CHANNELS = [
  { value: "x", label: "X", color: "var(--event-x)" },
  { value: "y", label: "Y", color: "var(--event-y)" },
  { value: "rotation", label: "Rotation", color: "var(--event-rotation)" },
] as const;

// ---- Main component ----

export interface GlobalModeProps {
  activeTab: string;
  // Quick action callbacks
  onShowBatchLine?: () => void;
  onShowLyricsSync?: () => void;
  onShowParametric?: () => void;
  // Dialog callbacks (passed through for reference, not directly used here)
  onShowPasteSpecial?: () => void;
  onShowRecordReview?: () => void;
  onShowExportDiff?: () => void;
  onShowSelectiveExport?: () => void;
  onShowGoToBeat?: () => void;
}

export function GlobalMode({ activeTab, ...actionProps }: GlobalModeProps) {
  if (activeTab === "hotkeys") return <HotkeyList sections={GLOBAL_HOTKEY_SECTIONS} />;
  // Default: "actions" tab
  return <GlobalActions {...actionProps} />;
}

// ---- Actions tab ----

function GlobalActions(props: Omit<GlobalModeProps, "activeTab">) {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  // xSnapEnabled and verticalLines are handled by XGridSection internally
  const showSpectrogram = useEditorStore((s) => s.showSpectrogram);
  const spectrogramOpacity = useEditorStore((s) => s.spectrogramOpacity);
  const noteSideFilter = useEditorStore((s) => s.noteSideFilter);
  // Onset detection state (Phase A: onsetSensitivity replaced by four new fields;
  //                        Phase B: target density saves per-chart when loaded)
  const onsetEnabled = useSettingsStore((s) => s.onsetDetectionEnabled);
  const onsetOpacity = useSettingsStore((s) => s.onsetOpacity);
  const onsetSnapToGrid = useSettingsStore((s) => s.onsetSnapToGrid);
  const onsetTargetDensity = useSettingsStore((s) => s.onsetTargetDensity);
  const onsetMinDisplayStrength = useSettingsStore((s) => s.onsetMinDisplayStrength);
  const onsetAbsFloor = useSettingsStore((s) => s.onsetAbsFloor);
  const onsetAdaptiveDelta = useSettingsStore((s) => s.onsetAdaptiveDelta);
  const chartOnsetTargetDensity = useChartStore((s) => s.chart.onset_target_density);
  const onsetAnalyzing = useEditorStore((s) => s.onsetAnalyzing);
  // Effective density = per-chart override if set, otherwise the global default.
  // This is what the slider reads; writes always go to the chart (see onChange).
  const effectiveOnsetDensity = chartOnsetTargetDensity ?? onsetTargetDensity;
  const recordMode = useEditorStore((s) => s.recordMode);
  const recordModeChannels = useEditorStore((s) => s.recordModeChannels);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const lineSortMode = useEditorStore((s) => s.lineSortMode);
  const lineStripCategoryFilter = useEditorStore((s) => s.lineStripCategoryFilter);
  const lines = useChartStore((s) => s.chart.lines);
  const addLine = useChartStore((s) => s.addLine);
  const bookmarkCount = useBookmarkStore((s) => s.bookmarks.length);
  // Beat grid settings (perpendicular beat subdivision overlay)
  const showBeatGrid = useSettingsStore((s) => s.showBeatGrid);
  const beatGridBeatsAhead = useSettingsStore((s) => s.beatGridBeatsAhead);

  // Inline panel state — when set, renders a panel component in place of the actions view
  const [inlinePanel, setInlinePanel] = useState<string | null>(null);

  const lineCount = lines.length;
  const noteCount = lines.reduce((acc, line) => acc + line.notes.length, 0);

  // If an inline panel is active, render it with a "Back to actions" header
  if (inlinePanel && INLINE_PANELS[inlinePanel]) {
    const panelDef = INLINE_PANELS[inlinePanel];
    const PanelComponent = panelDef.component;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Back button header */}
        <button
          type="button"
          onClick={() => setInlinePanel(null)}
          className="ui-btn ui-btn--ghost ui-btn--row"
          style={{ marginBottom: "var(--space-6)" }}
        >
          <Icon icon={ChevronLeft} />
          <span>Back to actions</span>
          <span style={{ marginLeft: "auto", fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{panelDef.label}</span>
        </button>
        {/* Inline panel content — rendered in a scrollable container */}
        <div style={{ flex: 1, overflow: "auto", borderTop: "var(--rule) solid var(--border-color)", paddingTop: "var(--space-4)" }}>
          <PanelComponent />
        </div>
      </div>
    );
  }

  const zoomPreset = ZOOM_PRESETS.find((z) => Math.abs(timelineZoom - z) < 0.05) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
      {/* Context badge */}
      <ContextBadge
        icon={CircleDashed}
        label="No selection"
        detail={`${lineCount} lines · ${noteCount} notes`}
        variant="global"
      />

      {/* Tools section — note tools show their own glyph */}
      <SectionHeader label="Tools" />
      <ToolGroup label="Tools">
        {TOOL_BUTTONS.map((btn) => btn.icon ? (
          <HotkeyButton
            key={btn.tool}
            icon={btn.icon}
            label={btn.label}
            hotkey={btn.hotkey}
            active={activeTool === btn.tool}
            onClick={() => setTool(btn.tool)}
          />
        ) : (
          <IconButton
            key={btn.tool}
            label={btn.label}
            shortcut={btn.hotkey}
            active={activeTool === btn.tool}
            onClick={() => setTool(btn.tool)}
          >
            <NoteGlyph kind={btn.note!} />
          </IconButton>
        ))}
      </ToolGroup>

      {/* Playback section */}
      <SectionHeader label="Playback" />
      <ToolGroup label="Playback">
        {PLAYBACK_BUTTONS.map((btn) => (
          <HotkeyButton
            key={btn.label}
            icon={btn.icon}
            label={btn.label}
            hotkey={btn.hotkey}
            onClick={btn.action}
          />
        ))}
      </ToolGroup>

      {/* Edit section */}
      <SectionHeader label="Edit" />
      <ToolGroup label="Edit">
        {EDIT_BUTTONS.map((btn) => (
          <HotkeyButton
            key={btn.label}
            icon={btn.icon}
            label={btn.label}
            hotkey={btn.hotkey}
            onClick={btn.action}
          />
        ))}
      </ToolGroup>

      {/* File section */}
      <SectionHeader label="File" />
      <ToolGroup label="File">
        {FILE_BUTTONS.map((btn) => (
          <HotkeyButton
            key={btn.label}
            icon={btn.icon}
            label={btn.label}
            hotkey={btn.hotkey}
            onClick={btn.action}
          />
        ))}
      </ToolGroup>

      {/* Quick actions — wired to open their respective dialogs */}
      <SectionHeader label="Quick actions" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <ActionButton icon={Plus} label="Add new line" onClick={() => addLine()} />
        <ActionButton icon={Rows3} label="Batch create lines…" onClick={props.onShowBatchLine} />
        <ActionButton icon={MicVocal} label="Lyrics sync…" onClick={props.onShowLyricsSync} />
        <ActionButton icon={Spline} label="Parametric trajectory…" onClick={props.onShowParametric} />
      </div>

      {/* Section markers — add, navigate prev/next */}
      <SectionHeader label="Section markers" count={bookmarkCount} />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <ActionButton icon={BookmarkPlus} label="Add marker" shortcut={{ action: "add_section_marker" }} onClick={() => addMarkerAtCurrentBeat()} />
        <ActionButton icon={SkipBack} label="Previous marker" shortcut={{ action: "prev_marker" }} onClick={() => seekToPrevBookmark()} />
        <ActionButton icon={SkipForward} label="Next marker" shortcut={{ action: "next_marker" }} onClick={() => seekToNextBookmark()} />
      </div>

      {/* ---- Select by range — beat/X range note selection ---- */}
      <SectionHeader label="Select by range" />
      <SelectByRangeSection />

      {/* X grid — shared toggle, presets, and status indicator */}
      <SectionHeader label="X grid" />
      <XGridSection />

      {/* ---- Beat grid — perpendicular beat grid overlay ---- */}
      <SectionHeader label="Beat grid" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        <div style={ROW}>
          <span style={{ ...CAPTION, flex: 1 }}>Show beat grid</span>
          <Toggle
            checked={showBeatGrid}
            label="Show beat grid"
            onChange={() => {
              const ss = useSettingsStore.getState();
              ss.updateSettings({ showBeatGrid: !ss.showBeatGrid });
            }}
          />
        </div>
        {showBeatGrid && (
          <div style={ROW}>
            <span style={{ ...CAPTION, flex: 1 }}>Beats ahead</span>
            <SegmentedControl
              label="Beats ahead"
              tone="accent"
              size="sm"
              options={([2, 4, 8] as const).map((n) => ({ value: n, label: String(n) }))}
              value={beatGridBeatsAhead}
              onChange={(n) => useSettingsStore.getState().updateSettings({ beatGridBeatsAhead: n })}
            />
          </div>
        )}
      </div>

      {/* ---- Display — spectrogram and note side filter ---- */}
      <SectionHeader label="Display" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        {/* Spectrogram toggle + opacity */}
        <div style={ROW}>
          <span style={{ ...CAPTION, minWidth: 72 }}>Spectrogram</span>
          {showSpectrogram ? (
            <input
              type="range" min="0" max="1" step="0.05"
              aria-label="Spectrogram opacity"
              value={spectrogramOpacity}
              onChange={(e) => useEditorStore.getState().setSpectrogramOpacity(parseFloat(e.target.value))}
              style={SLIDER}
            />
          ) : <span style={{ flex: 1 }} />}
          <Toggle
            checked={showSpectrogram}
            label="Show spectrogram"
            onChange={() => useEditorStore.getState().setShowSpectrogram(!showSpectrogram)}
          />
        </div>
        {/* ---- Onset detection toggle + density / filter sliders ----
             Phase A rewrite: the single sensitivity slider is replaced by four
             sliders that directly control the peak-picker. Target density is
             the main knob; the other three are advanced tuning.
        */}
        <div style={ROW}>
          <span style={{ ...CAPTION, minWidth: 72 }}>
            {onsetAnalyzing ? "Analyzing…" : "Onsets"}
          </span>
          {onsetEnabled ? (
            <Tooltip
              content={
                `Target onset density: ${effectiveOnsetDensity.toFixed(1)}/sec. ` +
                (chartOnsetTargetDensity !== undefined
                  ? "Saved to this chart."
                  : `Using global default (${onsetTargetDensity.toFixed(1)}/sec).`)
              }
            >
              <input
                type="range" min="0.5" max="8" step="0.1"
                aria-label="Target onset density"
                value={effectiveOnsetDensity}
                onChange={(e) => {
                  // Phase B: persist the density per-chart via the chartStore
                  // (undo-able, serialized to chart.json). The global setting
                  // stays as the fallback for charts that haven't overridden it.
                  useChartStore.getState().setOnsetTargetDensity(parseFloat(e.target.value));
                }}
                style={SLIDER}
              />
            </Tooltip>
          ) : <span style={{ flex: 1 }} />}
          {onsetEnabled && (
            <span style={READOUT}>
              {effectiveOnsetDensity.toFixed(1)}/s
            </span>
          )}
          <Toggle
            checked={onsetEnabled}
            label="Onset detection"
            onChange={() => {
              useSettingsStore.getState().updateSettings({
                onsetDetectionEnabled: !onsetEnabled,
              });
            }}
          />
        </div>
        {onsetEnabled && (
          <div style={ROW}>
            <span style={{ ...CAPTION, minWidth: 72 }}>Min strength</span>
            <Tooltip content="Visual filter: hide markers with salience below this. Updates instantly, no re-analysis.">
              <input
                type="range" min="0" max="1" step="0.01"
                aria-label="Minimum onset strength"
                value={onsetMinDisplayStrength}
                onChange={(e) => useSettingsStore.getState().updateSettings({
                  onsetMinDisplayStrength: parseFloat(e.target.value),
                })}
                style={SLIDER}
              />
            </Tooltip>
            <span style={READOUT}>
              {onsetMinDisplayStrength.toFixed(2)}
            </span>
          </div>
        )}
        {onsetEnabled && (
          <div style={ROW}>
            <span style={{ ...CAPTION, minWidth: 72 }}>Abs floor</span>
            <Tooltip content="Absolute threshold floor. A peak must exceed this (and the rolling median + delta).">
              <input
                type="range" min="0" max="1" step="0.01"
                aria-label="Absolute threshold floor"
                value={onsetAbsFloor}
                onChange={(e) => useSettingsStore.getState().updateSettings({
                  onsetAbsFloor: parseFloat(e.target.value),
                })}
                style={SLIDER}
              />
            </Tooltip>
            <span style={READOUT}>
              {onsetAbsFloor.toFixed(2)}
            </span>
          </div>
        )}
        {onsetEnabled && (
          <div style={ROW}>
            <span style={{ ...CAPTION, minWidth: 72 }}>Adaptive Δ</span>
            <Tooltip content="Delta added to the 1-second rolling median to form the adaptive threshold.">
              <input
                type="range" min="0" max="0.2" step="0.005"
                aria-label="Adaptive threshold delta"
                value={onsetAdaptiveDelta}
                onChange={(e) => useSettingsStore.getState().updateSettings({
                  onsetAdaptiveDelta: parseFloat(e.target.value),
                })}
                style={SLIDER}
              />
            </Tooltip>
            <span style={READOUT}>
              {onsetAdaptiveDelta.toFixed(3)}
            </span>
          </div>
        )}
        {onsetEnabled && (
          <div style={ROW}>
            <span style={{ ...CAPTION, minWidth: 72 }}>Opacity</span>
            <input
              type="range" min="0" max="1" step="0.05"
              aria-label="Onset marker opacity"
              value={onsetOpacity}
              onChange={(e) => useSettingsStore.getState().updateSettings({
                onsetOpacity: parseFloat(e.target.value),
              })}
              style={SLIDER}
            />
            <span style={READOUT}>
              {Math.round(onsetOpacity * 100)}%
            </span>
          </div>
        )}
        {onsetEnabled && (
          <label style={{ ...ROW, ...CAPTION, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={onsetSnapToGrid}
              onChange={(e) => useSettingsStore.getState().updateSettings({
                onsetSnapToGrid: e.target.checked,
              })}
              style={{ accentColor: "var(--accent-primary)" }}
            />
            Snap to beat grid
          </label>
        )}

        {/* Note side filter — All / Above / Below */}
        <div style={ROW}>
          <span style={{ ...CAPTION, minWidth: 72 }}>Notes</span>
          <SegmentedControl
            label="Note side filter"
            tone="accent"
            size="sm"
            block
            style={{ flex: 1 }}
            options={SIDE_OPTIONS}
            value={noteSideFilter}
            onChange={(f) => useEditorStore.getState().setNoteSideFilter(f)}
          />
        </div>
      </div>

      {/* ---- Record channels — shown when record mode is available ---- */}
      <SectionHeader label="Record channels" />
      <div style={{ ...ROW, gap: "var(--space-12)", marginBottom: "var(--space-8)", padding: "0 var(--space-4)" }}>
        {RECORD_CHANNELS.map((ch) => {
          const active = recordModeChannels[ch.value];
          return (
            <label key={ch.value} style={{
              display: "flex", alignItems: "center", gap: "var(--space-4)", cursor: "pointer",
              fontSize: "var(--fs-caption)",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
            }}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => useEditorStore.getState().setRecordModeChannels({ [ch.value]: e.target.checked })}
                style={{ accentColor: ch.color, width: 12, height: 12 }}
              />
              {ch.label}
            </label>
          );
        })}
        {recordMode && (
          <span style={{ marginLeft: "auto" }}>
            <Badge color="var(--error)">Recording</Badge>
          </span>
        )}
      </div>

      {/* ---- Timeline zoom ---- */}
      <SectionHeader label="Timeline zoom" />
      <div style={{ ...ROW, marginBottom: "var(--space-8)" }}>
        <SegmentedControl
          label="Timeline zoom presets"
          tone="accent"
          size="sm"
          options={ZOOM_PRESETS.map((z) => ({ value: z, label: `${z}×` }))}
          value={zoomPreset}
          onChange={(z) => useEditorStore.getState().setTimelineZoom(z)}
        />
        <input
          type="range" min="0.1" max="10" step="0.1"
          aria-label="Timeline zoom"
          value={timelineZoom}
          onChange={(e) => useEditorStore.getState().setTimelineZoom(parseFloat(e.target.value))}
          style={SLIDER}
        />
      </div>

      {/* ---- Line sort & filter ---- */}
      <SectionHeader label="Line sort & filter" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
        {/* Sort mode */}
        <SegmentedControl
          label="Line sort mode"
          tone="accent"
          size="sm"
          block
          options={SORT_OPTIONS}
          value={lineSortMode}
          onChange={(m) => useEditorStore.getState().setLineSortMode(m)}
        />
        {/* Category filter chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <Pill
            active={lineStripCategoryFilter === null}
            onClick={() => useEditorStore.getState().setLineStripCategoryFilter(null)}
          >
            All
          </Pill>
          {LINE_CATEGORIES.map((cat) => (
            <Pill
              key={cat.value}
              active={lineStripCategoryFilter?.includes(cat.value) ?? false}
              onClick={() => useEditorStore.getState().toggleLineStripCategory(cat.value)}
            >
              {cat.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Panels — clicking shows the panel content inline in this context panel */}
      <SectionHeader label="Panels" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {PANEL_ITEMS.map((item) => (
          <ActionButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onClick={() => setInlinePanel(item.panelId)}
          />
        ))}
      </div>
    </div>
  );
}

// ---- Hotkeys tab ----

const GLOBAL_HOTKEY_SECTIONS: HotkeySection[] = [
  {
    title: "Tools",
    keys: [
      { label: "Select tool", hotkey: { action: "select_tool" } },
      { label: "Eraser tool", hotkey: { action: "eraser_tool" } },
      { label: "Place tap", hotkey: { action: "place_tap" } },
      { label: "Place drag", hotkey: { action: "place_drag" } },
      { label: "Place flick", hotkey: { action: "place_flick" } },
      { label: "Place hold", hotkey: { action: "place_hold" } },
      { label: "Toggle beat sync", hotkey: "T" },
    ],
  },
  {
    title: "Navigation",
    keys: [
      { label: "Play / pause", hotkey: { action: "toggle_playback" } },
      { label: "Go to beat", hotkey: { action: "go_to_beat" } },
      { label: "Previous marker", hotkey: { action: "prev_marker" } },
      { label: "Next marker", hotkey: { action: "next_marker" } },
      { label: "Fit all lines in view", hotkey: "Shift+F" },
      { label: "Command palette", hotkey: "Ctrl+K" },
    ],
  },
  {
    title: "Editing",
    keys: [
      { label: "Undo", hotkey: { action: "undo" } },
      { label: "Redo", hotkey: { action: "redo" } },
      { label: "Save", hotkey: { action: "save" } },
      { label: "Select all notes", hotkey: { action: "select_all" } },
      { label: "Delete", hotkey: { action: "delete" } },
    ],
  },
];

const RANGE_INPUT: React.CSSProperties = {
  ...INPUT_STYLE,
  flex: 1,
  minWidth: 0,
  fontFamily: "var(--font-mono)",
};

/**
 * SelectByRangeSection — UI for selecting notes by beat range,
 * X range, and side filter on the current line.
 */
function SelectByRangeSection() {
  const [startBeat, setStartBeat] = useState("0");
  const [endBeat, setEndBeat] = useState("16");
  const [xMin, setXMin] = useState("");
  const [xMax, setXMax] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | "above" | "below">("all");
  const selectedLineIndex = useSelectedLineIndex();
  const lines = useChartStore((s) => s.chart.lines);

  const handleSelect = () => {
    if (selectedLineIndex === null) return;
    const line = lines[selectedLineIndex];
    if (!line) return;

    const sb = parseFloat(startBeat);
    const eb = parseFloat(endBeat);
    if (isNaN(sb) || isNaN(eb) || eb < sb) return;

    const xMinVal = xMin.trim() !== "" ? parseFloat(xMin) : null;
    const xMaxVal = xMax.trim() !== "" ? parseFloat(xMax) : null;

    const indices = selectByRange(line.notes, sb, eb, xMinVal, xMaxVal, sideFilter);

    // Always apply the selection (empty = deselect), and give feedback
    setNoteSelectionByIndex(indices);
    if (indices.length === 0) {
      useToastStore.getState().addToast({ message: "No notes matched the range", type: "info" });
    }
  };

  // Quick fill: set start from current playhead position
  const handleFromPlayhead = () => {
    const beat = getPlayheadBeat();
    setStartBeat(beat.toFixed(2));
  };

  const noLine = selectedLineIndex === null;

  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-8)",
      opacity: noLine ? "var(--opacity-disabled)" : 1,
    }}>
      {/* Beat range row */}
      <div style={{ ...ROW, gap: "var(--space-4)" }}>
        <span style={{ ...CAPTION, width: 30 }}>Beat</span>
        <input
          type="number" step="0.25" placeholder="Start"
          aria-label="Start beat"
          value={startBeat}
          onChange={(e) => setStartBeat(e.target.value)}
          style={RANGE_INPUT}
        />
        <span style={CAPTION}>to</span>
        <input
          type="number" step="0.25" placeholder="End"
          aria-label="End beat"
          value={endBeat}
          onChange={(e) => setEndBeat(e.target.value)}
          style={RANGE_INPUT}
        />
        <IconButton icon={LocateFixed} label="Set start from playhead" size="md" onClick={handleFromPlayhead} />
      </div>

      {/* X range row (optional) */}
      <div style={{ ...ROW, gap: "var(--space-4)" }}>
        <span style={{ ...CAPTION, width: 30 }}>X</span>
        <input
          type="number" step="1" placeholder="Min (opt)"
          aria-label="Minimum X"
          value={xMin}
          onChange={(e) => setXMin(e.target.value)}
          style={RANGE_INPUT}
        />
        <span style={CAPTION}>to</span>
        <input
          type="number" step="1" placeholder="Max (opt)"
          aria-label="Maximum X"
          value={xMax}
          onChange={(e) => setXMax(e.target.value)}
          style={RANGE_INPUT}
        />
        {/* Spacer keeps the inputs aligned with the beat row above */}
        <span style={{ width: "var(--control-md)", flexShrink: 0 }} />
      </div>

      {/* Side filter + select button */}
      <div style={{ ...ROW, gap: "var(--space-4)" }}>
        <span style={{ ...CAPTION, width: 30 }}>Side</span>
        <SegmentedControl
          label="Side filter"
          tone="accent"
          size="sm"
          block
          style={{ flex: 1 }}
          options={SIDE_OPTIONS}
          value={sideFilter}
          onChange={setSideFilter}
        />
        <Button variant="primary" size="sm" onClick={handleSelect} disabled={noLine}>
          Select
        </Button>
      </div>
    </div>
  );
}
