// ============================================================
// Central playhead-beat policy (finding L6)
//
// ONE place that turns the audio clock into a chart beat. Before this, ~40 call
// sites each re-derived "current beat" from (currentTime, chart.offset,
// audioLatencyMs, bpmList) and silently disagreed:
//   - EffectsEditor surfaces (EffectsTimeline / ShaderPreview / ShaderVarAnimEditor)
//     dropped chart.offset entirely, so the playhead / resolved shader values
//     landed `offset` beats off (finding T3).
//   - UnifiedCanvas RENDERED game visuals at offset+latency but HIT-TESTED at raw
//     offset, so clicking a line/bookmark missed by `audioLatencyMs` worth of beats
//     (the render-vs-hittest skew). GamePreview already did the right thing.
//
// The policy, decided once here — there are exactly two spaces:
//   - latencyCompensated = false → raw chart.offset. Use for EDITING / placement /
//     editor timelines: a created note/event/marker, and a timeline playhead, sit on
//     the TRUE musical beat.
//   - latencyCompensated = true  → chart.offset + audioLatencyMs. Use for the
//     GAME-PREVIEW render AND anything that must agree with those drawn frames
//     (hit-testing the rendered lines/notes/bookmarks). The renderers shift visuals
//     by audioLatencyMs so they line up with what the user HEARS; hit-testing has to
//     use the same shift or clicks miss. grep effectiveOffset.
//
// NOTE — a third, unrelated latency exists: bookmarkStore.latencyOffset is INPUT
// latency for live marker tapping (improvPlace). That is applied to the TIME, not
// the offset, so those callers pass it via the `time` option, not this flag.
//
// Pure functions that already receive an explicit (time, offset) — gameRenderer,
// PixiGameRenderer, aiContextBuilder, NoteProjection, onset-time conversions — are
// NOT store-reading playhead derivations and intentionally stay as they are.
//
// Cross-file coupling: reads audioStore (currentTime), chartStore (offset +
// getCachedBpmList), settingsStore (audioLatencyMs). No store imports THIS module
// back, so the chain is cycle-free — which is what finally lets editorStore drop its
// broken require() in toggleStepRecord (finding S2). grep getPlayheadBeat.
// ============================================================

import { useAudioStore } from "../stores/audioStore";
import { useChartStore, getCachedBpmList } from "../stores/chartStore";
import { useSettingsStore } from "../stores/settingsStore";

/**
 * Seconds to subtract from the audio clock before BPM→beat conversion.
 *
 * @param latencyCompensated true → chart.offset + audioLatencyMs (game visuals and
 *   the hit-testing of those visuals); false → raw chart.offset (editing / editor
 *   timelines). Defaults to false.
 */
export function playbackOffsetSeconds(latencyCompensated = false): number {
  const offset = useChartStore.getState().chart.offset;
  if (!latencyCompensated) return offset;
  return offset + useSettingsStore.getState().audioLatencyMs / 1000;
}

export interface PlayheadBeatOptions {
  /**
   * Include audioLatencyMs (game-visual space). Default false (raw chart beat —
   * the right choice for editing and editor timelines).
   */
  latencyCompensated?: boolean;
  /**
   * Time in seconds to convert. Default: the live audioStore.currentTime. Pass the
   * value a React component already subscribes to (so reactivity is preserved), or a
   * pre-shifted time (e.g. input-latency-compensated marker placement).
   */
  time?: number;
  /**
   * Clamp the post-offset chart time to ≥ 0 before conversion. Default false (matches
   * the bare `currentTime - offset` form). Set true to reproduce the `Math.max(0, …)`
   * call sites — no negative beats for times before the chart's first beat.
   */
  clampNonNegative?: boolean;
}

/**
 * The current playhead position as a float beat. The single source of the
 * (time, offset, latency, bpm) → beat policy; see the file header for which spaces
 * use which `latencyCompensated`. Uses the chart-store-cached BpmList (no per-call
 * allocation). grep getPlayheadBeat.
 */
export function getPlayheadBeat(opts: PlayheadBeatOptions = {}): number {
  const time = opts.time ?? useAudioStore.getState().currentTime;
  const chartTime = time - playbackOffsetSeconds(opts.latencyCompensated ?? false);
  const t = opts.clampNonNegative ? Math.max(0, chartTime) : chartTime;
  return getCachedBpmList().beatAtFloat(t);
}
