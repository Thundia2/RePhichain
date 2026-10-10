// ============================================================
// Unrolled View Bar
//
// Compact viewport bar above the UnrolledCanvas. Two tri-state
// segmented controls for layer visibility:
//
//   Notes  [All] [Ghost] [None]
//   Events [All] [Ghost] [None]
//
// Where:
//   "all"   — full opacity, hit-tests enabled (you can edit)
//   "ghost" — globalAlpha 0.3, hit-tests disabled (no misclicks)
//   "none"  — not rendered, not hit-tested
//
// The actual rendering + hit gating live in UnrolledCanvas.tsx and
// canvas/unrolledRenderer.ts; this bar is purely the control UI.
//
// State source: editorStore.unrolledNoteVisibility / .unrolledEventVisibility.
// These are volatile (reset on app load) — they describe transient
// view focus, not a persistent preference. The persistent setting
// lives in settingsStore.unrolledShowEventSpanTints (Settings →
// Editor → Unrolled Editor).
// ============================================================

import { useEditorStore } from "../../stores/editorStore";
import type { LayerVisibility } from "../../stores/editorStore";
import { SegmentedControl, type SegmentOption } from "../common/SegmentedControl";
import { Tooltip } from "../common/Tooltip";

const OPTIONS: SegmentOption<LayerVisibility>[] = [
  { value: "all", label: "All" },
  { value: "ghost", label: "Ghost" },
  { value: "none", label: "None" },
];

/**
 * Single labeled tri-state segmented control — the same
 * SegmentedControl used for the layer switch in KeyframeBar.
 */
function VisibilityGroup({
  label,
  value,
  onChange,
  title,
}: {
  label: string;
  value: LayerVisibility;
  onChange: (v: LayerVisibility) => void;
  title?: string;
}) {
  return (
    <Tooltip content={title} disabled={!title}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <span
          style={{
            fontSize: "var(--fs-control)",
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        <SegmentedControl
          label={`${label} visibility`}
          size="sm"
          options={OPTIONS}
          value={value}
          onChange={onChange}
        />
      </div>
    </Tooltip>
  );
}

export function UnrolledViewBar() {
  const noteVis = useEditorStore((s) => s.unrolledNoteVisibility);
  const eventVis = useEditorStore((s) => s.unrolledEventVisibility);
  const setNoteVis = useEditorStore((s) => s.setUnrolledNoteVisibility);
  const setEventVis = useEditorStore((s) => s.setUnrolledEventVisibility);

  return (
    <div
      style={{
        height: 32,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-16)",
        padding: "0 var(--space-10)",
        background: "var(--bg-secondary)",
        borderBottom: "var(--rule) solid var(--border-color)",
      }}
    >
      <VisibilityGroup
        label="Notes"
        value={noteVis}
        onChange={setNoteVis}
        title={
          "Notes layer · " +
          "All: render and edit notes normally · " +
          "Ghost: dim and lock — keeps them as visual reference but no clicks land · " +
          "None: hide entirely"
        }
      />

      <VisibilityGroup
        label="Events"
        value={eventVis}
        onChange={setEventVis}
        title={
          "Events layer · " +
          "All: render and click events (color-coded by kind) · " +
          "Ghost: dim and lock — visual reference, no clicks · " +
          "None: hide entirely (gutter collapses back to base width)"
        }
      />

      <div style={{ flex: 1 }} />
      {/*
        Spacer reserved for future viewport options. Likely candidates:
        mini-preview toggle, lane snap, keyframe bar pin. Adding any
        new option here keeps controls grouped and consistent.
      */}
    </div>
  );
}
