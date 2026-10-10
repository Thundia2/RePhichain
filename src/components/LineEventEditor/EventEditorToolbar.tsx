// ============================================================
// Event Editor Toolbar — Property selector and toggles
//
// Horizontal bar with property segmented controls (core and
// extended kinds, each chip with a dot in the event colour),
// "All lines" / "Notes" toggles, and the beat display. A layer
// switch row appears when the line has event layers.
// ============================================================

import { useEditorStore } from "../../stores/editorStore";
import { useSelectedLineIndex } from "../../stores/selection";
import { useChartStore } from "../../stores/chartStore";
import type { LineEventKind } from "../../types/chart";
import { EVENT_COLORS } from "../../constants/eventColors";
import { SegmentedControl, type SegmentOption } from "../common/SegmentedControl";
import { Pill } from "../common/UIKit";
import { LaneDot } from "../KeyframeBar/KeyframeBarHeader";
import { LANE_LABEL } from "../KeyframeBar/curveEditorUtils";

const CORE_PROPERTIES: { kind: LineEventKind; full: string }[] = [
  { kind: "x", full: "X position" },
  { kind: "y", full: "Y position" },
  { kind: "rotation", full: "Rotation" },
  { kind: "opacity", full: "Opacity" },
  { kind: "speed", full: "Speed" },
];

const EXTENDED_PROPERTIES: { kind: LineEventKind; full: string }[] = [
  { kind: "scale_x", full: "Scale X" },
  { kind: "scale_y", full: "Scale Y" },
  { kind: "color", full: "Colour" },
  { kind: "text", full: "Text" },
  { kind: "incline", full: "Incline" },
  { kind: "gif", full: "GIF progress" },
];

const LAYER_OPTIONS: SegmentOption<number>[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ value: i, label: String(i), title: `Event layer ${i}` })),
  { value: -1, label: "Flat", title: "Flat events (non-layered)" },
];

export function EventEditorToolbar() {
  const activeProperty = useEditorStore((s) => s.eventEditorActiveProperty);
  const setActiveProperty = useEditorStore((s) => s.setEventEditorActiveProperty);
  const activeLayer = useEditorStore((s) => s.eventEditorActiveLayer);
  const setActiveLayer = useEditorStore((s) => s.setEventEditorActiveLayer);
  const showAllLines = useEditorStore((s) => s.eventEditorShowAllLines);
  const showNotes = useEditorStore((s) => s.eventEditorShowNotes);
  const toggleShowAllLines = useEditorStore((s) => s.toggleEventEditorShowAllLines);
  const toggleShowNotes = useEditorStore((s) => s.toggleEventEditorShowNotes);
  const currentBeat = useEditorStore((s) => s.eventEditorCurrentBeat);
  const selectedLineIndex = useSelectedLineIndex();
  const hasLayers = useChartStore((s) => {
    if (selectedLineIndex === null) return false;
    const line = s.chart.lines[selectedLineIndex];
    return line?.event_layers != null && line.event_layers.length > 0;
  });

  const toOptions = (props: { kind: LineEventKind; full: string }[]): SegmentOption<LineEventKind>[] =>
    props.map(({ kind, full }) => ({
      value: kind,
      title: full,
      label: (
        <>
          <LaneDot color={EVENT_COLORS[kind]} on={activeProperty === kind} />
          {LANE_LABEL[kind]}
        </>
      ),
    }));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderBottom: "var(--rule) solid var(--border-color)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      {/* Main toolbar row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          padding: "0 var(--space-8)",
          height: 32,
        }}
      >
        {/* Core property selector */}
        <SegmentedControl
          label="Core properties"
          size="sm"
          options={toOptions(CORE_PROPERTIES)}
          value={activeProperty}
          onChange={setActiveProperty}
        />

        {/* Extended property selector */}
        <SegmentedControl
          label="Extended properties"
          size="sm"
          options={toOptions(EXTENDED_PROPERTIES)}
          value={activeProperty}
          onChange={setActiveProperty}
        />

        {/* Toggle: Show all lines */}
        <Pill active={showAllLines} onClick={toggleShowAllLines} title="Show all lines">
          All lines
        </Pill>

        {/* Toggle: Show notes */}
        <Pill active={showNotes} onClick={toggleShowNotes} title="Show notes">
          Notes
        </Pill>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Beat display */}
        <span
          style={{
            fontSize: "var(--fs-caption)",
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          Beat {currentBeat.toFixed(2)}
        </span>
      </div>

      {/* Layer selector row (only shown when line has event layers) */}
      {hasLayers && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-8)",
            padding: "0 var(--space-8) var(--space-4)",
            minHeight: 24,
          }}
        >
          <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Layer</span>
          <SegmentedControl
            label="Event layer"
            size="sm"
            options={LAYER_OPTIONS}
            value={activeLayer}
            onChange={setActiveLayer}
          />
        </div>
      )}
    </div>
  );
}
