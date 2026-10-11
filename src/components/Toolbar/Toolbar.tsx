// ============================================================
// Toolbar — Left vertical tool rail (44px)
//
// Icon-only tools: note tools show their NoteGlyph, the rest use
// Lucide icons. Names and shortcuts live in the tooltip. The active
// tool is accent-selected with an accent icon.
//
// Recent change: removed the Pattern (Ctrl+G) toolbar button (the
// hotkey itself remains active in useHotkeys.ts) and added a 9-button
// event-placement section below the note tools — only visible when
// the active tab is an unrolled editor. Each event tool maps to a
// `place_event_<kind>` EditorTool variant and is colour-coded via
// EVENT_COLORS. Keyboard shortcuts (CapsLock+Q .. CapsLock+O) require
// CapsLock — see the matching CapsLock-gated handlers in useHotkeys.ts.
// ============================================================

import type React from "react";
import { Diamond, Eraser, Footprints, Magnet, MousePointer2, PanelBottom, Rows3, Timer } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTabStore } from "../../stores/tabStore";
import { useHotkeyLabels } from "../../hooks/useHotkeyLabel";
import type { EditorTool } from "../../types/editor";
import type { NoteKind } from "../../types/chart";
import { EVENT_COLORS } from "../../constants/eventColors";
import { IconButton } from "../common/IconButton";
import { Icon } from "../common/Icon";
import { NoteGlyph } from "../common/NoteGlyph";
import { Tooltip } from "../common/Tooltip";

interface ToolDef {
  id: EditorTool;
  label: string;
  /** Rebindable shortcut: an action id in DEFAULT_HOTKEYS. */
  action?: string;
  /** Fixed shortcut key, for tools outside the registry. */
  key?: string;
  /** The shortcut needs CapsLock on. */
  capsLock?: boolean;
  glyph: React.ReactNode;
}

const NOTE_TOOL = (kind: NoteKind, label: string): ToolDef => ({
  id: `place_${kind}` as EditorTool,
  label,
  action: `place_${kind}`,
  glyph: <NoteGlyph kind={kind} />,
});

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", action: "select_tool", glyph: <Icon icon={MousePointer2} size={16} /> },
  NOTE_TOOL("tap", "Tap note"),
  NOTE_TOOL("drag", "Drag note"),
  NOTE_TOOL("flick", "Flick note"),
  NOTE_TOOL("hold", "Hold note"),
  { id: "eraser", label: "Eraser", action: "eraser_tool", glyph: <Icon icon={Eraser} size={16} /> },
];

// Event-placement tools — shown only on unrolled tabs. Order mirrors
// the QWERTY top row (Q W E R T Y U I O), all CapsLock-gated.
// The first four share the note tools' keys (Q/W/E/R by default), so they follow a rebind.
const EVENT_TOOL = (id: EditorTool, label: string, key: { action: string } | string, color: string): ToolDef => ({
  id,
  label,
  ...(typeof key === "string" ? { key } : key),
  capsLock: true,
  glyph: <Icon icon={Diamond} size={16} style={{ color, fill: color, fillOpacity: 0.25 }} />,
});

const EVENT_TOOLS: ToolDef[] = [
  EVENT_TOOL("place_event_x", "X position event", { action: "place_tap" }, EVENT_COLORS.x),
  EVENT_TOOL("place_event_y", "Y position event", { action: "place_drag" }, EVENT_COLORS.y),
  EVENT_TOOL("place_event_rotation", "Rotation event", { action: "place_flick" }, EVENT_COLORS.rotation),
  EVENT_TOOL("place_event_opacity", "Opacity event", { action: "place_hold" }, EVENT_COLORS.opacity),
  EVENT_TOOL("place_event_speed", "Speed event", "T", EVENT_COLORS.speed),
  EVENT_TOOL("place_event_scale_x", "Scale X event", "Y", EVENT_COLORS.scale_x),
  EVENT_TOOL("place_event_scale_y", "Scale Y event", "U", EVENT_COLORS.scale_y),
  EVENT_TOOL("place_event_color", "Colour event", "I", EVENT_COLORS.color),
  EVENT_TOOL("place_event_text", "Text event", "O", EVENT_COLORS.text),
];

const GRID_PRESETS = [11, 21, 31, 17] as const;

function RailDivider() {
  return <div aria-hidden="true" style={{ width: 20, height: 1, margin: "var(--space-4) 0", background: "var(--border-color)", flexShrink: 0 }} />;
}

export function Toolbar() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const beatSyncPlacement = useEditorStore((s) => s.beatSyncPlacement);
  const toggleBeatSync = useEditorStore((s) => s.toggleBeatSyncPlacement);
  const canvasActivePanelId = useEditorStore((s) => s.canvasActivePanelId);
  const setCanvasActivePanel = useEditorStore((s) => s.setCanvasActivePanel);
  const stepRecordActive = useEditorStore((s) => s.stepRecordActive);
  const toggleStepRecord = useEditorStore((s) => s.toggleStepRecord);
  const xSnapEnabled = useEditorStore((s) => s.xSnapEnabled);
  const toggleXSnap = useEditorStore((s) => s.toggleXSnap);
  const verticalLines = useEditorStore((s) => s.verticalLines);
  const setVerticalLines = useEditorStore((s) => s.setVerticalLines);
  const showBeatGrid = useSettingsStore((s) => s.showBeatGrid);
  const hk = useHotkeyLabels();
  const shortcutOf = (tool: ToolDef) =>
    (tool.capsLock ? "CapsLock+" : "") + (tool.action ? hk(tool.action) : tool.key ?? "");

  // Event tools are only relevant on unrolled tabs — the unified
  // canvas has no clean beat-axis click for placement and the home /
  // panel tabs don't host a canvas at all. Read the active tab's
  // type via the same shape App.tsx uses.
  const isUnrolledTab = useTabStore((s) => {
    const activeTab = s.tabs.find((t) => t.id === s.activeTabId);
    return activeTab?.type === "unrolled_editor";
  });

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      style={{
        width: "var(--rail-width)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-8) 0",
        background: "var(--bg-secondary)",
        borderRight: "var(--rule) solid var(--border-color)",
        flexShrink: 0,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {TOOLS.map((tool) => (
        <IconButton
          key={tool.id}
          label={tool.label}
          shortcut={shortcutOf(tool)}
          tooltipPosition="right"
          active={activeTool === tool.id}
          onClick={() => setTool(tool.id)}
        >
          {tool.glyph}
        </IconButton>
      ))}

      {/* Event-placement tools — unrolled-only.
          Conditionally rendered so unified / chart / panel tabs keep
          their lean toolbar. activeTool persists across tabs (e.g. if
          user has place_event_x selected then switches to unified, the
          unified canvas just ignores the click — no error path). */}
      {isUnrolledTab && (
        <>
          <RailDivider />
          {EVENT_TOOLS.map((tool) => (
            <IconButton
              key={tool.id}
              label={tool.label}
              shortcut={shortcutOf(tool)}
              tooltipPosition="right"
              active={activeTool === tool.id}
              onClick={() => setTool(tool.id)}
            >
              {tool.glyph}
            </IconButton>
          ))}
        </>
      )}

      <RailDivider />

      <IconButton
        icon={Timer}
        label="Beat sync: place notes at the current beat"
        shortcut="T"
        tooltipPosition="right"
        active={beatSyncPlacement}
        onClick={toggleBeatSync}
      />
      <IconButton
        icon={Footprints}
        label="Step record: advance the beat on each click"
        shortcut={hk("step_record")}
        tooltipPosition="right"
        active={stepRecordActive}
        onClick={toggleStepRecord}
      />

      <RailDivider />

      <IconButton
        icon={Magnet}
        label={`X snap to ${verticalLines}-line grid`}
        shortcut="Shift+X"
        tooltipPosition="right"
        active={xSnapEnabled}
        onClick={toggleXSnap}
      />

      {/* Vertical line presets — set line count AND enable snap in one click */}
      <div role="radiogroup" aria-label="X snap grid" className="ui-segmented ui-segmented--sm" style={{ flexDirection: "column", flexShrink: 0 }}>
        {GRID_PRESETS.map((n) => {
          const isActive = xSnapEnabled && verticalLines === n;
          return (
            <Tooltip key={n} content={`${n}-line grid (step ${Math.round(1350 / (n - 1))})`}>
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                className={isActive ? "ui-segmented__opt is-selected" : "ui-segmented__opt"}
                style={{ width: "var(--control-lg)", padding: 0, fontFamily: "var(--font-mono)", ...(isActive ? { background: "var(--accent-primary)", color: "var(--on-accent)" } : null) }}
                onClick={() => {
                  setVerticalLines(n);
                  if (!xSnapEnabled) toggleXSnap();
                }}
              >
                {n}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <RailDivider />

      <IconButton
        icon={Rows3}
        label="Beat grid: show beat subdivisions across the line"
        tooltipPosition="right"
        active={showBeatGrid}
        onClick={() => {
          const ss = useSettingsStore.getState();
          ss.updateSettings({ showBeatGrid: !ss.showBeatGrid });
        }}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <IconButton
        icon={PanelBottom}
        label={canvasActivePanelId ? "Hide panels" : "Show panels"}
        tooltipPosition="right"
        active={!!canvasActivePanelId}
        onClick={() => {
          if (canvasActivePanelId) {
            setCanvasActivePanel(null);
          } else {
            setCanvasActivePanel("timeline");
          }
        }}
      />
    </div>
  );
}
