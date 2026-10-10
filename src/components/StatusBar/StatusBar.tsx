// ============================================================
// Status Bar — Bottom info strip (20px)
//
// Shows: "4 lines · 312 notes · 96 events", mark mode, the active
// group, panel toggles, zoom and the editor view badge.
// ============================================================

import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useGroupStore } from "../../stores/groupStore";
import { useTabStore } from "../../stores/tabStore";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

function StatusToggle({ label, icon, shortcut, tooltip, active, onClick }: {
  label: string;
  icon: typeof ChevronUp;
  shortcut: string;
  tooltip: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={tooltip} shortcut={shortcut}>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className="ui-hover"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          height: 16,
          padding: "0 var(--space-4)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          color: active ? "var(--accent-primary)" : "var(--text-secondary)",
          font: "inherit",
          fontSize: "var(--fs-caption)",
          cursor: "pointer",
        }}
      >
        {label}
        <Icon icon={icon} size={12} />
      </button>
    </Tooltip>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function StatusBar() {
  const lineCount = useChartStore((s) => s.chart.lines.length);
  const totalNotes = useChartStore((s) => s.totalNoteCount());
  const totalEvents = useChartStore((s) => s.totalEventCount());
  const zoom = useEditorStore((s) => s.canvasViewport.zoom);
  const improvisationMode = useEditorStore((s) => s.improvisationMode);
  const activeGroup = useGroupStore((s) => s.getActiveGroup());
  const keyframeBarOpen = useEditorStore((s) => s.keyframeBarOpen);
  const inspectorOpen = useEditorStore((s) => s.unifiedInspectorOpen);
  const toggleKeyframeBar = useEditorStore((s) => s.toggleKeyframeBar);
  const toggleInspector = useEditorStore((s) => s.toggleUnifiedInspector);
  const curveEditorExpanded = useEditorStore((s) => s.curveEditorExpanded);
  const toggleCurveEditorExpanded = useEditorStore((s) => s.toggleCurveEditorExpanded);
  // Read active tab type to display correct editor label
  const activeTabType = useTabStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    return tab?.type;
  });

  return (
    <div
      role="status"
      style={{
        height: "var(--statusbar-height)",
        display: "flex",
        alignItems: "center",
        padding: "0 var(--space-10)",
        gap: "var(--space-12)",
        background: "var(--bg-primary)",
        borderTop: "var(--rule) solid var(--border-color)",
        fontSize: "var(--fs-caption)",
        color: "var(--text-secondary)",
        flexShrink: 0,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)" }}>
        {plural(lineCount, "line")} · {plural(totalNotes, "note")} · {plural(totalEvents, "event")}
      </span>
      {improvisationMode && (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-4)", color: "var(--error)", fontWeight: 600 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: "var(--error)" }} />
            Mark mode
          </span>
          <span>Q tap · W drag · E flick · R hold · 1–3 misc</span>
        </>
      )}
      {activeGroup && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-4)", color: "var(--text-primary)" }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: activeGroup.color }} />
          Group: {activeGroup.name}
        </span>
      )}
      {!keyframeBarOpen && (
        <StatusToggle label="Keyframes" icon={ChevronUp} shortcut="K" tooltip="Show keyframe bar" onClick={toggleKeyframeBar} />
      )}
      {!keyframeBarOpen && !inspectorOpen && (
        <StatusToggle label="Inspector" icon={ChevronRight} shortcut="I" tooltip="Show inspector" onClick={toggleInspector} />
      )}
      {keyframeBarOpen && (
        <StatusToggle
          label="Curves"
          icon={curveEditorExpanded ? ChevronDown : ChevronUp}
          shortcut="Shift+K"
          tooltip={curveEditorExpanded ? "Collapse curve editor" : "Expand curve editor"}
          active={curveEditorExpanded}
          onClick={toggleCurveEditorExpanded}
        />
      )}
      <div style={{ flex: 1 }} />
      <span>Zoom {(zoom * 100).toFixed(0)}%</span>
      <span className="tab-type-badge">
        {activeTabType === "unrolled_editor" ? "Unrolled" : "Unified"}
      </span>
    </div>
  );
}
