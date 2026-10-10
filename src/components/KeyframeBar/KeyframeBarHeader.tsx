// ============================================================
// Keyframe Bar Header — Lane toggles, normalize, expand/popout
//
// 32px strip on bg-secondary: "Curves" section label, a chip row of
// event-lane toggles (each with a dot in the event colour), a
// "Normalize" text toggle, and expand / pop-out icon buttons.
// ============================================================

import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { EVENT_COLORS } from "../../constants/eventColors";
import type { LineEventKind } from "../../types/chart";
import { IconButton } from "../common/IconButton";
import { Pill } from "../common/UIKit";
import { LANE_LABEL } from "./curveEditorUtils";

const LANE_DEFS: { kind: LineEventKind; name: string }[] = [
  { kind: "x", name: "X position" },
  { kind: "y", name: "Y position" },
  { kind: "rotation", name: "Rotation" },
  { kind: "opacity", name: "Opacity" },
  { kind: "speed", name: "Speed" },
  { kind: "scale_x", name: "Scale X" },
  { kind: "scale_y", name: "Scale Y" },
  { kind: "color", name: "Colour" },
  { kind: "text", name: "Text" },
];

/** Event-colour dot: filled when the lane is on, outlined when off. */
export function LaneDot({ color, on }: { color: string; on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 6,
        height: 6,
        borderRadius: "var(--radius-full)",
        flexShrink: 0,
        boxSizing: "border-box",
        background: on ? color : "transparent",
        border: `var(--rule) solid ${color}`,
      }}
    />
  );
}

export function KeyframeBarHeader() {
  const expanded = useEditorStore((s) => s.curveEditorExpanded);
  const poppedOut = useEditorStore((s) => s.curveEditorPoppedOut);
  const visibleLanes = useEditorStore((s) => s.curveEditorVisibleLanes);
  const normalized = useEditorStore((s) => s.curveEditorNormalized);
  const toggleLane = useEditorStore((s) => s.toggleCurveEditorLane);
  const toggleExpanded = useEditorStore((s) => s.toggleCurveEditorExpanded);
  const toggleNormalized = useEditorStore((s) => s.toggleCurveEditorNormalized);
  const setPoppedOut = useEditorStore((s) => s.setCurveEditorPoppedOut);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        padding: "0 var(--space-8) 0 var(--space-10)",
        flexShrink: 0,
        height: 32,
        borderBottom: "var(--rule) solid var(--border-color)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {/* Section label */}
      <span
        style={{
          fontSize: "var(--fs-control)",
          fontWeight: 600,
          color: "var(--text-secondary)",
        }}
      >
        Curves
      </span>

      {/* Lane toggle chips */}
      <div
        role="group"
        aria-label="Curve lanes"
        className="ui-segmented ui-segmented--sm"
        style={{ minWidth: 0, overflow: "hidden" }}
      >
        {LANE_DEFS.map(({ kind, name }) => {
          const active = visibleLanes.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={active}
              className={active ? "ui-segmented__opt is-selected" : "ui-segmented__opt"}
              onClick={() => toggleLane(kind)}
              title={`${name} curve`}
            >
              <LaneDot color={EVENT_COLORS[kind]} on={active} />
              {LANE_LABEL[kind]}
            </button>
          );
        })}
      </div>

      {/* Normalize toggle */}
      <Pill
        active={normalized}
        onClick={toggleNormalized}
        title="Normalize lanes to 0–1 range for comparison"
      >
        Normalize
      </Pill>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Expand toggle */}
      <IconButton
        icon={expanded ? ChevronDown : ChevronUp}
        label={expanded ? "Collapse curve graph" : "Expand curve graph"}
        shortcut="Shift+K"
        size="md"
        onClick={toggleExpanded}
      />

      {/* Pop-out button */}
      {expanded && (
        <IconButton
          icon={ExternalLink}
          label="Pop out"
          shortcut="Ctrl+Shift+K"
          size="md"
          active={poppedOut}
          onClick={() => {
            if (poppedOut) {
              setPoppedOut(false);
            } else {
              setPoppedOut(true);
            }
          }}
        />
      )}
    </div>
  );
}
