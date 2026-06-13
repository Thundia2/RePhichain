// ============================================================
// Apply Preset — Resolves tokens and creates events at playhead
// ============================================================

import type { EventPreset } from "../types/preset";
import type { LineEvent, LineEventKind } from "../types/chart";
import { floatToBeat } from "../types/chart";
import { useChartStore } from "../stores/chartStore";
import { evaluateLineEventsWithLayers } from "../canvas/events";
import { getPlayheadBeat } from "./playhead";

function resolveToken(
  token: string | number,
  kind: LineEventKind,
  currentValues: Record<string, number>,
): number {
  if (typeof token === "number") return token;
  switch (token) {
    case "$CURRENT": return currentValues[kind] ?? 0;
    case "$CENTER": return 0;
    case "$LEFT": return -675;
    case "$RIGHT": return 675;
    case "$TOP": return 450;
    case "$BOTTOM": return -450;
    case "$FULL_OPACITY": return 255;
    case "$ZERO": return 0;
    default: return parseFloat(token) || 0;
  }
}

export function applyPresetAtPlayhead(
  lineIndex: number,
  preset: EventPreset,
  durationScale: number = 1.0,
): void {
  const cs = useChartStore.getState();
  const line = cs.chart.lines[lineIndex];
  if (!line) return;

  const insertBeat = getPlayheadBeat({ clampNonNegative: true });

  const state = evaluateLineEventsWithLayers(line.events, line.event_layers, insertBeat);

  const currentValues: Record<string, number> = {
    x: state.x,
    y: state.y,
    rotation: state.rotation * (180 / Math.PI),
    opacity: state.opacity * 255,
    speed: state.speed,
    scale_x: state.scale_x,
    scale_y: state.scale_y,
  };

  const newEvents: LineEvent[] = [];
  for (const tmpl of preset.template) {
    // Builtin format uses `beatOffset` + `value`; EventTemplate uses `startBeatOffset` + `startValue`/`endValue`
    if ("beatOffset" in tmpl) {
      // ---- Builtin template entry ----
      const startBeat = insertBeat + tmpl.beatOffset * durationScale;
      const endBeat = insertBeat + tmpl.endBeatOffset * durationScale;

      let value: LineEvent["value"];
      if ("constant" in tmpl.value) {
        value = { constant: resolveToken(tmpl.value.constant, tmpl.kind, currentValues) };
      } else {
        value = {
          transition: {
            start: resolveToken(tmpl.value.transition.start, tmpl.kind, currentValues),
            end: resolveToken(tmpl.value.transition.end, tmpl.kind, currentValues),
            easing: tmpl.value.transition.easing,
          },
        };
      }

      newEvents.push({
        kind: tmpl.kind,
        start_beat: floatToBeat(startBeat),
        end_beat: floatToBeat(endBeat),
        value,
      });
    } else {
      // ---- EventTemplate entry (from Preset Builder) ----
      const startBeatF = tmpl.startBeatOffset[0] + tmpl.startBeatOffset[1] / tmpl.startBeatOffset[2];
      const endBeatF = tmpl.endBeatOffset[0] + tmpl.endBeatOffset[1] / tmpl.endBeatOffset[2];
      const startBeat = insertBeat + startBeatF * durationScale;
      const endBeat = insertBeat + endBeatF * durationScale;

      const startVal = resolveToken(tmpl.startValue, tmpl.kind, currentValues);
      const endVal = resolveToken(tmpl.endValue, tmpl.kind, currentValues);

      newEvents.push({
        kind: tmpl.kind,
        start_beat: floatToBeat(startBeat),
        end_beat: floatToBeat(endBeat),
        value: { transition: { start: startVal, end: endVal, easing: tmpl.easing } },
      });
    }
  }

  if (newEvents.length > 0) {
    // Route each event flat<->layer (finding L3) so presets applied to a
    // layered (RPE-imported) line land in the active layer the evaluator reads,
    // not flat where they'd be invisible + dropped on export. One transaction
    // (finding L1) keeps the whole preset a single undo entry, matching the old
    // batchMultiLineMutations behavior. addEventRouted with no layer = auto
    // (layer 0 on a layered line); extended kinds always route to flat.
    cs.transaction(() => {
      for (const ev of newEvents) {
        cs.addEventRouted(lineIndex, ev);
      }
    });
  }
}
