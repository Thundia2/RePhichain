// ============================================================
// Central playhead-beat policy (finding L6)
//
// Locks the (time, offset, latency, bpm) → beat policy that ~40 sites used to
// re-decide independently:
//   - raw vs latency-compensated offset (the render-vs-hittest skew lived here),
//   - the optional `time` override (preserves React reactivity / input-latency),
//   - the clamp flag (the `Math.max(0, …)` sites).
//
// grep getPlayheadBeat / playbackOffsetSeconds.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { getPlayheadBeat, playbackOffsetSeconds } from "../utils/playhead";
import { useAudioStore } from "../stores/audioStore";
import { useChartStore } from "../stores/chartStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { PhichainChart } from "../types/chart";

// 120 BPM ⇒ 1 beat = 0.5 s ⇒ beatAtFloat(t) = t * 2 (for the post-offset chart time).
function chart(offset: number): PhichainChart {
  return { format: 1, offset, bpm_list: [{ beat: [0, 0, 1], bpm: 120 }], lines: [] };
}

describe("getPlayheadBeat policy (L6)", () => {
  beforeEach(() => {
    useChartStore.setState({ chart: chart(0.1), isLoaded: true });
    useSettingsStore.setState({ audioLatencyMs: 200 }); // 0.2 s render compensation
    useAudioStore.setState({ currentTime: 1.0 });
  });

  it("raw subtracts only chart.offset (editing / editor timelines)", () => {
    // (1.0 - 0.1) * 2 = 1.8
    expect(getPlayheadBeat()).toBeCloseTo(1.8, 6);
    expect(getPlayheadBeat({ latencyCompensated: false })).toBeCloseTo(1.8, 6);
  });

  it("latencyCompensated also subtracts audioLatencyMs (game visuals + hit-test)", () => {
    // (1.0 - 0.1 - 0.2) * 2 = 1.4 — this gap is the render-vs-hittest skew that
    // UnifiedCanvas used to introduce by rendering compensated but hit-testing raw.
    expect(getPlayheadBeat({ latencyCompensated: true })).toBeCloseTo(1.4, 6);
  });

  it("the time override is used verbatim instead of the live clock", () => {
    // (2.0 - 0.1) * 2 = 3.8 — and independent of audioStore.currentTime.
    expect(getPlayheadBeat({ time: 2.0 })).toBeCloseTo(3.8, 6);
    expect(getPlayheadBeat({ time: 2.0, latencyCompensated: true })).toBeCloseTo(3.4, 6);
  });

  it("clampNonNegative floors the chart time at 0 (the Math.max(0,…) sites)", () => {
    useAudioStore.setState({ currentTime: 0.05 }); // before the chart's first beat (offset 0.1)
    expect(getPlayheadBeat({ clampNonNegative: false })).toBeCloseTo(-0.1, 6); // (0.05-0.1)*2
    expect(getPlayheadBeat({ clampNonNegative: true })).toBe(0);
  });

  it("playbackOffsetSeconds exposes the same offset policy", () => {
    expect(playbackOffsetSeconds(false)).toBeCloseTo(0.1, 6);
    expect(playbackOffsetSeconds(true)).toBeCloseTo(0.3, 6); // 0.1 + 0.2
  });
});
