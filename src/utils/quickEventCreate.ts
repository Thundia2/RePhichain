// ============================================================
// Quick Event Creation — Context menu helpers
// ============================================================

import type { LineEvent, LineEventKind, EasingType } from "../types/chart";
import { beatToFloat, floatToBeat } from "../types/chart";
import { useChartStore } from "../stores/chartStore";
import { useEditorStore } from "../stores/editorStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useAudioStore } from "../stores/audioStore";
import { evaluateLineEventsWithLayers } from "../canvas/events";
import { resolveActiveKindEvents } from "./eventRouting";
import { generateEventId } from "./noteUid";
import { DEFAULT_EVENT_VALUES } from "../constants/eventConfig";
import { BpmList } from "./bpmList";

/**
 * Create a constant event at the given beat/value.
 */
export function createQuickConstant(
  lineIndex: number,
  kind: LineEventKind,
  beat: number,
  value: number,
): void {
  const cs = useChartStore.getState();
  const line = cs.chart.lines[lineIndex];
  if (!line) return;

  // Route flat<->layer (finding L3): look in (and write to) the array the
  // evaluator reads for this kind — the active layer on a layered chart, else
  // flat. Editing flat on a layered chart would be invisible + dropped on export.
  const activeLayer = useEditorStore.getState().eventEditorActiveLayer;
  const kindEvents = resolveActiveKindEvents(line, kind, activeLayer);

  // Find an event of this kind spanning the target beat
  const event = kindEvents.find((e) => {
    const start = beatToFloat(e.start_beat);
    const end = beatToFloat(e.end_beat);
    return beat >= start && beat <= end;
  });

  if (event) {
    if (event.id && "constant" in event.value) {
      cs.editEventById(lineIndex, event.id, { value: { constant: value } });
    }
    // For transitions we'd need to split — keep simple for now
  } else {
    cs.addEventRouted(lineIndex, {
      kind,
      start_beat: floatToBeat(beat),
      end_beat: floatToBeat(beat + 1),
      value: { constant: value },
    }, activeLayer);
  }
}

/**
 * Create a transition from the current value at playhead to a target value.
 */
export function createQuickTransition(
  lineIndex: number,
  kind: LineEventKind,
  targetValue: number,
  durationBeats?: number,
  easing?: EasingType,
): void {
  const cs = useChartStore.getState();
  const ss = useSettingsStore.getState();
  const line = cs.chart.lines[lineIndex];
  if (!line) return;

  const duration = durationBeats ?? ss.quickTransitionDuration;
  const easingType = easing ?? (ss.quickTransitionEasing as EasingType);

  const { currentTime } = useAudioStore.getState();
  const bpmList = new BpmList(cs.chart.bpm_list);
  const currentBeat = bpmList.beatAtFloat(Math.max(0, currentTime - cs.chart.offset));
  const state = evaluateLineEventsWithLayers(line.events, line.event_layers, currentBeat);

  const currentValueMap: Record<string, number> = {
    x: state.x,
    y: state.y,
    rotation: state.rotation * (180 / Math.PI),
    opacity: state.opacity * 255,
    speed: state.speed,
    scale_x: state.scale_x,
    scale_y: state.scale_y,
  };
  const startValue = currentValueMap[kind] ?? 0;

  // Route flat<->layer (finding L3) so the transition lands where the evaluator reads.
  cs.addEventRouted(lineIndex, {
    kind,
    start_beat: floatToBeat(currentBeat),
    end_beat: floatToBeat(currentBeat + duration),
    value: { transition: { start: startValue, end: targetValue, easing: easingType } },
  }, useEditorStore.getState().eventEditorActiveLayer);
}

/**
 * Create a constant event of *any* kind at [startBeat, endBeat] with
 * a sensible default value:
 *   - color → { color_constant: [255, 255, 255] }   (white)
 *   - text  → { text_value: "" }                    (empty)
 *   - else  → { constant: DEFAULT_EVENT_VALUES[kind] ?? 0 }
 *
 * Returns the new event's stable id (finding L2/L3), or null on failure
 * (no line). The event is routed flat<->layer (finding L3) so on a
 * layered chart it lands in the active layer the evaluator reads — a flat
 * placement would be invisible in preview and dropped on export.
 *
 * Used by the unrolled canvas's mouse-down event-placement flow
 * (UnrolledCanvas.tsx). The canvas then drags `end_beat` live via
 * `cs.editEventById(...)`, which resolves the event by id wherever it
 * landed — so the drag survives the flat/layer split and any re-sort.
 */
export function placeEventAtBeats(
  lineIndex: number,
  kind: LineEventKind,
  startBeat: number,
  endBeat: number,
): string | null {
  const cs = useChartStore.getState();
  const line = cs.chart.lines[lineIndex];
  if (!line) return null;

  // Normalize: caller may pass endBeat <= startBeat; clamp to a tiny
  // positive duration so the event is visible. The mouse-move handler
  // is responsible for enforcing the snap-grid minimum duration.
  const safeStart = Math.max(0, startBeat);
  const safeEnd = endBeat > safeStart ? endBeat : safeStart + 1 / 32;

  // Resolve the value union by kind
  let value: LineEvent["value"];
  if (kind === "color") {
    value = { color_constant: [255, 255, 255] };
  } else if (kind === "text") {
    value = { text_value: "" };
  } else {
    value = { constant: DEFAULT_EVENT_VALUES[kind] ?? 0 };
  }

  // Assign the id up front so we can return it: addEventRouted keeps an
  // existing id, and the caller drags by this id rather than an array index
  // (which would be wrong once the write routes into a layer's kind-array).
  const id = generateEventId();
  const newEvent: LineEvent = {
    id,
    kind,
    start_beat: floatToBeat(safeStart),
    end_beat: floatToBeat(safeEnd),
    value,
  };

  cs.addEventRouted(lineIndex, newEvent, useEditorStore.getState().eventEditorActiveLayer);
  return id;
}
