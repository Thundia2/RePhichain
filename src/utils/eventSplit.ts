// ============================================================
// Split selected events at the playhead (finding L7 — shared helper)
//
// Extracted so the Edit-menu item ("Split Event at Playhead", useMenus.ts) and the
// split_event hotkey (registry default "s", useHotkeys.ts) run the SAME logic instead
// of duplicating it. Depends on: chartStore.replaceEvent, the selection helpers, the
// central playhead beat (utils/playhead), and evaluateEasing (canvas/easings) for the
// transition-midpoint value. grep splitSelectedEventsAtPlayhead.
// ============================================================

import { useChartStore } from "../stores/chartStore";
import { getSelectedLineIndex, getSelectedEventIndices } from "../stores/selection";
import { getPlayheadBeat } from "./playhead";
import { beatToFloat, floatToBeat } from "../types/chart";
import { evaluateEasing } from "../canvas/easings";

/**
 * Split every selected event on the selected line at the current playhead beat.
 * No-op when nothing is selected or the playhead isn't strictly inside an event.
 * A transition event splits with the easing-correct midpoint value; a constant event
 * splits into two equal-valued halves.
 */
export function splitSelectedEventsAtPlayhead(): void {
  const cs = useChartStore.getState();
  const lineIndex = getSelectedLineIndex();
  const eventIndices = getSelectedEventIndices();
  if (lineIndex === null || eventIndices.length === 0) return;
  const line = cs.chart.lines[lineIndex];
  if (!line) return;

  const splitBeat = getPlayheadBeat({ clampNonNegative: true });

  // Reverse order so each replaceEvent's index shift doesn't invalidate later indices.
  const sorted = [...eventIndices].sort((a, b) => b - a);
  for (const idx of sorted) {
    const event = line.events[idx];
    if (!event) continue;
    const startB = beatToFloat(event.start_beat);
    const endB = beatToFloat(event.end_beat);
    if (splitBeat <= startB || splitBeat >= endB) continue;

    const t = (splitBeat - startB) / (endB - startB);

    if ("transition" in event.value) {
      const { start, end, easing } = event.value.transition;
      const mid = start + (end - start) * evaluateEasing(easing, t);
      cs.replaceEvent(lineIndex, idx, [
        { ...structuredClone(event), end_beat: floatToBeat(splitBeat), value: { transition: { start, end: mid, easing } } },
        { ...structuredClone(event), start_beat: floatToBeat(splitBeat), value: { transition: { start: mid, end, easing } } },
      ]);
    } else if ("constant" in event.value) {
      cs.replaceEvent(lineIndex, idx, [
        { ...structuredClone(event), end_beat: floatToBeat(splitBeat) },
        { ...structuredClone(event), start_beat: floatToBeat(splitBeat) },
      ]);
    }
  }
}
