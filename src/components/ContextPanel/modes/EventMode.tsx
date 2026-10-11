// ============================================================
// EventMode — Context panel content for event selection mode
//
// Recent change: Implemented Split, Merge, Swap, Duplicate quick
// actions. Fixed Layer select reactivity (was using getState()
// during render). Split interpolates values at playhead using
// easing approximation.
// Styling: quick actions are a ToolGroup of Lucide IconButtons; easing
// chips are pills with a star toggle; the Hotkeys tab uses HotkeyList.
// ============================================================

import React, { useMemo } from "react";
import { CircleDot, CopyPlus, Merge, Repeat, Scissors, Star, Trash2 } from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectedLineIndex, useSelectedEventIndices } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { useToastStore } from "../../../stores/toastStore";
import { getPlayheadBeat } from "../../../utils/playhead";
import type { LineEvent, EasingType } from "../../../types/chart";
import { beatToFloat, floatToBeat } from "../../../types/chart";
import { EVENT_COLORS } from "../../../constants/eventConfig";
import { NumericInput } from "../../common/FormFields";
import { Icon } from "../../common/Icon";
import { IconButton } from "../../common/IconButton";
import { ToolGroup } from "../../common/ToolGroup";
import { INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";

// ---- Shared sub-components (extracted to shared/) ----
import { HotkeyButton } from "../shared/HotkeyButton";
import { HotkeyList, type HotkeySection } from "../shared/HotkeyList";
import { SectionHeader } from "../shared/SectionHeader";
import { ContextBadge } from "../shared/ContextBadge";

// ---- All named easings (grouped by family) ----

const EASING_FAMILIES: Array<{ family: string; easings: string[] }> = [
  { family: "Linear", easings: ["linear"] },
  { family: "Sine", easings: ["ease_in_sine", "ease_out_sine", "ease_in_out_sine"] },
  { family: "Quad", easings: ["ease_in_quad", "ease_out_quad", "ease_in_out_quad"] },
  { family: "Cubic", easings: ["ease_in_cubic", "ease_out_cubic", "ease_in_out_cubic"] },
  { family: "Quart", easings: ["ease_in_quart", "ease_out_quart", "ease_in_out_quart"] },
  { family: "Quint", easings: ["ease_in_quint", "ease_out_quint", "ease_in_out_quint"] },
  { family: "Expo", easings: ["ease_in_expo", "ease_out_expo", "ease_in_out_expo"] },
  { family: "Circ", easings: ["ease_in_circ", "ease_out_circ", "ease_in_out_circ"] },
  { family: "Back", easings: ["ease_in_back", "ease_out_back", "ease_in_out_back"] },
  { family: "Elastic", easings: ["ease_in_elastic", "ease_out_elastic", "ease_in_out_elastic"] },
  { family: "Bounce", easings: ["ease_in_bounce", "ease_out_bounce", "ease_in_out_bounce"] },
];

// ---- Helpers ----

function getEasingString(event: LineEvent): string {
  const val = event.value;
  if ("transition" in val) {
    const e = val.transition.easing;
    if (typeof e === "string") return e;
    if (typeof e === "object") {
      if ("custom" in e) return `bezier(${e.custom.join(",")})`;
      if ("steps" in e) return `steps(${e.steps})`;
      if ("elastic" in e) return `elastic(${e.elastic})`;
    }
  }
  if ("color_transition" in val) {
    const e = val.color_transition.easing;
    if (typeof e === "string") return e;
  }
  return "linear";
}

function getTransitionValues(event: LineEvent): { start: number; end: number } | null {
  const val = event.value;
  if ("transition" in val) return { start: val.transition.start, end: val.transition.end };
  if ("constant" in val) return { start: val.constant, end: val.constant };
  return null;
}

function easingDisplayName(easing: string): string {
  return easing.replace(/^ease_/, "").replace(/_/g, " ");
}

/** "scale_x" → "Scale X", "x" → "X" (sentence case, axis letters upper-case). */
function eventKindLabel(kind: string): string {
  const words = kind.split("_");
  return words
    .map((w, i) => (w.length === 1 ? w.toUpperCase() : i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ---- Props ----

export interface EventModeProps {
  activeTab: string;
}

// ---- Main component ----

export function EventMode({ activeTab }: EventModeProps) {
  switch (activeTab) {
    case "edit": return <EditTab />;
    case "easing": return <EasingTab />;
    case "hotkeys": return <EventHotkeys />;
    default: return <EditTab />;
  }
}

// ---- Edit sub-tab ----

function EditTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedEventIndices = useSelectedEventIndices();
  const eventEditorActiveLayer = useEditorStore((s) => s.eventEditorActiveLayer);
  const lines = useChartStore((s) => s.chart.lines);
  const editEvent = useChartStore((s) => s.editEvent);
  const removeEvents = useChartStore((s) => s.removeEvents);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  if (selectedLineIndex === null || selectedEventIndices.length === 0) return null;
  const line = lines[selectedLineIndex];
  if (!line) return null;

  // Focus on the first selected event for detailed editing
  const primaryIdx = selectedEventIndices[0];
  const event = line.events[primaryIdx];
  if (!event) return null;

  const kindColor = EVENT_COLORS[event.kind] ?? "var(--text-secondary)";
  const isBatch = selectedEventIndices.length > 1;
  const easingStr = getEasingString(event);
  const transVals = getTransitionValues(event);

  const handleDelete = () => {
    removeEvents(selectedLineIndex, selectedEventIndices);
    clearSelection();
  };

  // ---- Split: split primary event at playhead into two events ----
  const handleSplit = () => {
    const cs = useChartStore.getState();
    const playheadBeat = getPlayheadBeat();
    const startBeat = beatToFloat(event.start_beat);
    const endBeat = beatToFloat(event.end_beat);
    // Playhead must be strictly between start and end
    if (playheadBeat <= startBeat || playheadBeat >= endBeat) {
      useToastStore.getState().addToast({ message: "Move playhead between event start/end to split", type: "warning" });
      return;
    }
    const t = (playheadBeat - startBeat) / (endBeat - startBeat); // 0..1 progress
    const val = event.value;
    if ("transition" in val) {
      // Interpolate value at split point using easing approximation
      const midVal = val.transition.start + (val.transition.end - val.transition.start) * approximateEasing(getEasingString(event), t);
      const firstHalf: LineEvent = {
        ...structuredClone(event),
        end_beat: floatToBeat(playheadBeat),
        value: { transition: { start: val.transition.start, end: midVal, easing: val.transition.easing } },
      };
      const secondHalf: LineEvent = {
        ...structuredClone(event),
        start_beat: floatToBeat(playheadBeat),
        value: { transition: { start: midVal, end: val.transition.end, easing: val.transition.easing } },
      };
      cs.replaceEvent(selectedLineIndex, primaryIdx, [firstHalf, secondHalf]);
    } else if ("constant" in val) {
      // Split a constant event — both halves keep the same constant value
      const firstHalf: LineEvent = { ...structuredClone(event), end_beat: floatToBeat(playheadBeat) };
      const secondHalf: LineEvent = { ...structuredClone(event), start_beat: floatToBeat(playheadBeat) };
      cs.replaceEvent(selectedLineIndex, primaryIdx, [firstHalf, secondHalf]);
    } else {
      useToastStore.getState().addToast({ message: "Cannot split this event type", type: "warning" });
    }
  };

  // ---- Merge: merge selected events into one ----
  const handleMerge = () => {
    if (selectedEventIndices.length < 2) {
      useToastStore.getState().addToast({ message: "Select 2+ events to merge", type: "warning" });
      return;
    }
    const cs = useChartStore.getState();
    const events = selectedEventIndices
      .map((i) => line.events[i])
      .filter(Boolean)
      .sort((a, b) => beatToFloat(a.start_beat) - beatToFloat(b.start_beat));
    if (events.length < 2) return;
    const first = events[0];
    const last = events[events.length - 1];
    // Build merged event: span from first.start to last.end
    const startVal = getTransitionValues(first);
    const endVal = getTransitionValues(last);
    const merged: LineEvent = {
      ...structuredClone(first),
      start_beat: first.start_beat,
      end_beat: last.end_beat,
    };
    // If both have transition values, merge into a single transition
    if (startVal && endVal && "transition" in first.value) {
      merged.value = {
        transition: { start: startVal.start, end: endVal.end, easing: first.value.transition.easing },
      };
    }
    // Remove all selected events and insert merged one
    cs.removeEvents(selectedLineIndex, selectedEventIndices);
    cs.addEvent(selectedLineIndex, merged);
    clearSelection();
  };

  // ---- Swap: reverse start/end values of a transition event ----
  const handleSwap = () => {
    const val = event.value;
    if ("transition" in val) {
      editEvent(selectedLineIndex, primaryIdx, {
        value: { transition: { ...val.transition, start: val.transition.end, end: val.transition.start } },
      });
    } else if ("color_transition" in val) {
      editEvent(selectedLineIndex, primaryIdx, {
        value: { color_transition: { ...val.color_transition, start: val.color_transition.end, end: val.color_transition.start } },
      });
    } else {
      useToastStore.getState().addToast({ message: "Only transition events can be swapped", type: "warning" });
    }
  };

  // ---- Duplicate: clone selected events, placing copies after the originals ----
  const handleDuplicate = () => {
    const cs = useChartStore.getState();
    for (const idx of selectedEventIndices) {
      const ev = line.events[idx];
      if (!ev) continue;
      const duration = beatToFloat(ev.end_beat) - beatToFloat(ev.start_beat);
      const clone: LineEvent = {
        ...structuredClone(ev),
        start_beat: ev.end_beat,
        end_beat: floatToBeat(beatToFloat(ev.end_beat) + duration),
      };
      cs.addEvent(selectedLineIndex, clone);
    }
  };

  // Handlers accept numbers directly — NumericInput handles string-to-number
  // conversion and intermediate typing states ("-", "0.", etc.)
  const handleEditBeat = (field: "start_beat" | "end_beat", numVal: number) => {
    const beat = floatToBeat(numVal);
    editEvent(selectedLineIndex, primaryIdx, { [field]: beat });
  };

  const handleEditTransition = (field: "start" | "end", numVal: number) => {
    const val = event.value;
    if ("transition" in val) {
      const newTrans = { ...val.transition, [field]: numVal };
      editEvent(selectedLineIndex, primaryIdx, { value: { transition: newTrans } });
    } else if ("constant" in val) {
      // Convert constant to transition when user edits start/end
      editEvent(selectedLineIndex, primaryIdx, {
        value: { transition: { start: field === "start" ? numVal : val.constant, end: field === "end" ? numVal : val.constant, easing: "linear" as EasingType } },
      });
    }
  };

  const handleEditEasingClip = (side: "left" | "right", numVal: number) => {
    if (side === "left") editEvent(selectedLineIndex, primaryIdx, { easing_left: numVal });
    else editEvent(selectedLineIndex, primaryIdx, { easing_right: numVal });
  };

  const handleEasingSelect = (easing: string) => {
    const val = event.value;
    if ("transition" in val) {
      editEvent(selectedLineIndex, primaryIdx, {
        value: { transition: { ...val.transition, easing: easing as EasingType } },
      });
    }
  };

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE, width: "100%", fontFamily: "var(--font-mono)",
  };
  const selectStyle: React.CSSProperties = { ...SELECT_STYLE, width: "100%" };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-2)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Context badge */}
      <ContextBadge
        icon={<span style={{ display: "inline-flex", color: kindColor }}><Icon icon={CircleDot} /></span>}
        label={`${eventKindLabel(event.kind)} event${isBatch ? ` (+${selectedEventIndices.length - 1})` : ""}`}
        detail={`on ${line.name}`}
        variant="event"
      />

      {/* Timing section */}
      <SectionHeader label="Timing" />
      <div style={{ display: "flex", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>Start beat</label>
          <NumericInput
            style={inputStyle}
            step="0.25"
            value={beatToFloat(event.start_beat)}
            onChange={(v) => handleEditBeat("start_beat", v)}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>End beat</label>
          <NumericInput
            style={inputStyle}
            step="0.25"
            value={beatToFloat(event.end_beat)}
            onChange={(v) => handleEditBeat("end_beat", v)}
          />
        </div>
      </div>

      {/* Value section */}
      <SectionHeader label="Value" />
      <div style={{ display: "flex", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>Start</label>
          <NumericInput
            style={inputStyle}
            step="1"
            value={transVals?.start ?? 0}
            onChange={(v) => handleEditTransition("start", v)}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>End</label>
          <NumericInput
            style={inputStyle}
            step="1"
            value={transVals?.end ?? 0}
            onChange={(v) => handleEditTransition("end", v)}
          />
        </div>
      </div>

      {/* Easing section */}
      <SectionHeader label="Easing" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <label style={labelStyle}>Type</label>
          <select
            style={selectStyle}
            value={easingStr}
            onChange={(e) => handleEasingSelect(e.target.value)}
          >
            {EASING_FAMILIES.flatMap((f) =>
              f.easings.map((eas) => (
                <option key={eas} value={eas}>{easingDisplayName(eas)}</option>
              )),
            )}
          </select>
        </div>

        {/* SVG curve preview */}
        <div style={{
          height: 72, background: "var(--bg-tertiary)", borderRadius: "var(--radius-md)",
          border: "var(--hairline) solid var(--border-color)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <EasingPreview easing={easingStr} width={120} height={60} color={kindColor} />
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={labelStyle}>Left clip</label>
            <NumericInput
              style={inputStyle}
              step="0.05"
              min={0}
              max={1}
              value={event.easing_left ?? 0}
              onChange={(v) => handleEditEasingClip("left", v)}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label style={labelStyle}>Right clip</label>
            <NumericInput
              style={inputStyle}
              step="0.05"
              min={0}
              max={1}
              value={event.easing_right ?? 1}
              onChange={(v) => handleEditEasingClip("right", v)}
            />
          </div>
        </div>
      </div>

      {/* Advanced section */}
      <SectionHeader label="Advanced" />
      <div style={{ display: "flex", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>Linkgroup</label>
          <input
            style={inputStyle}
            type="number"
            value={event.linkgroup ?? 0}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) editEvent(selectedLineIndex, primaryIdx, { linkgroup: val });
            }}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <label style={labelStyle}>Layer</label>
          <select
            style={selectStyle}
            value={eventEditorActiveLayer}
            onChange={(e) => useEditorStore.getState().setEventEditorActiveLayer(parseInt(e.target.value, 10))}
          >
            <option value="-1">Flat events</option>
            <option value="0">Layer 0</option>
            <option value="1">Layer 1</option>
            <option value="2">Layer 2</option>
            <option value="3">Layer 3</option>
            <option value="4">Layer 4</option>
          </select>
        </div>
      </div>

      {/* Quick action buttons */}
      <SectionHeader label="Quick actions" />
      <ToolGroup label="Quick actions">
        <HotkeyButton icon={Scissors} label="Split at playhead" hotkey={{ action: "split_event" }} onClick={handleSplit} />
        <HotkeyButton icon={Merge} label="Merge" onClick={handleMerge} />
        <HotkeyButton icon={Repeat} label="Swap start and end" onClick={handleSwap} />
        <HotkeyButton icon={CopyPlus} label="Duplicate" onClick={handleDuplicate} />
        <HotkeyButton icon={Trash2} label="Delete" hotkey={{ action: "delete" }} onClick={handleDelete} />
      </ToolGroup>
    </div>
  );
}

// ---- Easing SVG preview ----

function EasingPreview({ easing, width, height, color }: {
  easing: string; width: number; height: number; color: string;
}) {
  // Generate simple SVG path from easing name
  const points: string[] = [];
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const steps = 40;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Simple approximation: use t directly for linear, or basic curve shapes
    const y = approximateEasing(easing, t);
    const px = pad + t * w;
    const py = pad + (1 - y) * h;
    points.push(`${px},${py}`);
  }

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* Grid lines */}
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="var(--border-color)" strokeWidth={0.5} />
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border-color)" strokeWidth={0.5} />
      {/* Diagonal reference */}
      <line x1={pad} y1={height - pad} x2={width - pad} y2={pad} stroke="var(--border-color)" strokeWidth={0.5} strokeDasharray="2,2" />
      {/* Curve */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Approximate easing function output for SVG preview. */
function approximateEasing(name: string, t: number): number {
  // Simplified implementations for preview purposes
  if (name === "linear") return t;
  if (name === "ease_in_quad") return t * t;
  if (name === "ease_out_quad") return 1 - (1 - t) * (1 - t);
  if (name === "ease_in_out_quad") return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  if (name === "ease_in_cubic") return t * t * t;
  if (name === "ease_out_cubic") return 1 - Math.pow(1 - t, 3);
  if (name === "ease_in_out_cubic") return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (name === "ease_in_sine") return 1 - Math.cos((t * Math.PI) / 2);
  if (name === "ease_out_sine") return Math.sin((t * Math.PI) / 2);
  if (name === "ease_in_out_sine") return -(Math.cos(Math.PI * t) - 1) / 2;
  if (name === "ease_in_quart") return t * t * t * t;
  if (name === "ease_out_quart") return 1 - Math.pow(1 - t, 4);
  if (name === "ease_in_out_quart") return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  if (name === "ease_in_quint") return t * t * t * t * t;
  if (name === "ease_out_quint") return 1 - Math.pow(1 - t, 5);
  if (name === "ease_in_out_quint") return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  if (name === "ease_in_expo") return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
  if (name === "ease_out_expo") return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  if (name === "ease_in_out_expo") {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  }
  if (name === "ease_in_circ") return 1 - Math.sqrt(1 - t * t);
  if (name === "ease_out_circ") return Math.sqrt(1 - Math.pow(t - 1, 2));
  if (name === "ease_in_out_circ") return t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
  if (name === "ease_in_back") { const c3 = 2.70158; return (c3 + 1) * t * t * t - c3 * t * t; }
  if (name === "ease_out_back") { const c3 = 2.70158; return 1 + (c3 + 1) * Math.pow(t - 1, 3) + c3 * Math.pow(t - 1, 2); }
  if (name === "ease_in_out_back") {
    const c2 = 1.70158 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }
  // Fallback: elastic, bounce, custom -> show as linear
  return t;
}

// ---- Easing sub-tab ----

function EasingTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedEventIndices = useSelectedEventIndices();
  const lines = useChartStore((s) => s.chart.lines);
  const editEvent = useChartStore((s) => s.editEvent);
  const favoriteEasings = useFavoritesStore((s) => s.favoriteEasings);
  const toggleFavoriteEasing = useFavoritesStore((s) => s.toggleFavoriteEasing);
  const recordEasingUse = useFavoritesStore((s) => s.recordEasingUse);

  const primaryEvent = useMemo(() => {
    if (selectedLineIndex === null || selectedEventIndices.length === 0) return null;
    const line = lines[selectedLineIndex];
    if (!line) return null;
    return line.events[selectedEventIndices[0]] ?? null;
  }, [selectedLineIndex, selectedEventIndices, lines]);

  const currentEasing = primaryEvent ? getEasingString(primaryEvent) : "linear";

  const handleApplyEasing = (easing: string) => {
    if (selectedLineIndex === null) return;
    recordEasingUse(easing);

    for (const idx of selectedEventIndices) {
      const ev = lines[selectedLineIndex]?.events[idx];
      if (!ev) continue;
      const val = ev.value;
      if ("transition" in val) {
        editEvent(selectedLineIndex, idx, {
          value: { transition: { ...val.transition, easing: easing as EasingType } },
        });
      } else if ("constant" in val) {
        // Convert to transition with same value
        editEvent(selectedLineIndex, idx, {
          value: { transition: { start: val.constant, end: val.constant, easing: easing as EasingType } },
        });
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Favorites section */}
      {favoriteEasings.length > 0 && (
        <>
          <SectionHeader label="Favorites" count={favoriteEasings.length} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
            {favoriteEasings.map((eas) => (
              <EasingChip
                key={eas}
                easing={eas}
                isActive={currentEasing === eas}
                isFavorite
                onApply={() => handleApplyEasing(eas)}
                onToggleFavorite={() => toggleFavoriteEasing(eas)}
              />
            ))}
          </div>
        </>
      )}

      {/* All easings grouped by family */}
      {EASING_FAMILIES.map((family) => (
        <React.Fragment key={family.family}>
          <SectionHeader label={family.family} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", padding: "0 var(--space-4)" }}>
            {family.easings.map((eas) => (
              <EasingChip
                key={eas}
                easing={eas}
                isActive={currentEasing === eas}
                isFavorite={favoriteEasings.includes(eas)}
                onApply={() => handleApplyEasing(eas)}
                onToggleFavorite={() => toggleFavoriteEasing(eas)}
              />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---- Easing chip component ----

function EasingChip({ easing, isActive, isFavorite, onApply, onToggleFavorite }: {
  easing: string; isActive: boolean; isFavorite: boolean;
  onApply: () => void; onToggleFavorite: () => void;
}) {
  const name = easingDisplayName(easing);
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        borderRadius: "var(--radius-md)",
        background: isActive ? "var(--accent-selected)" : "var(--bg-active)",
      }}
    >
      <button
        type="button"
        aria-pressed={isActive}
        onClick={onApply}
        className="ui-hover"
        style={{
          border: "none", cursor: "pointer",
          padding: "var(--space-4) var(--space-4) var(--space-4) var(--space-8)",
          borderRadius: "var(--radius-md)",
          fontFamily: "inherit", fontSize: "var(--fs-caption)",
          fontWeight: isActive ? 600 : 400,
          color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
        }}
      >
        {name}
      </button>
      <IconButton
        label={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        size="sm"
        active={isFavorite}
        className="ui-icon-btn--quiet"
        onClick={onToggleFavorite}
        style={{ marginRight: "var(--space-2)" }}
      >
        <Icon icon={Star} size={12} fill={isFavorite ? "currentColor" : "none"} />
      </IconButton>
    </span>
  );
}

// ---- Hotkeys sub-tab ----

// Only keys that are actually bound (useHotkeys / useClipboard); registry
// actions show their current binding from Settings > Hotkeys.
const EVENT_HOTKEY_SECTIONS: HotkeySection[] = [
  {
    title: "Event editing",
    keys: [
      { label: "Split at playhead", hotkey: { action: "split_event" } },
      { label: "Delete", hotkey: { action: "delete" } },
      { label: "Copy", hotkey: "Ctrl+C" },
      { label: "Cut", hotkey: "Ctrl+X" },
      { label: "Paste", hotkey: "Ctrl+V" },
      { label: "Undo", hotkey: { action: "undo" } },
      { label: "Redo", hotkey: { action: "redo" } },
    ],
  },
  {
    title: "Navigation",
    keys: [
      { label: "Move later", hotkey: { action: "move_up" } },
      { label: "Move earlier", hotkey: { action: "move_down" } },
      { label: "Go to beat", hotkey: { action: "go_to_beat" } },
    ],
  },
];

function EventHotkeys() {
  return <HotkeyList sections={EVENT_HOTKEY_SECTIONS} />;
}
