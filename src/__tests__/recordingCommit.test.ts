// ============================================================
// Recording commit conversion (finding D1, critical)
//
// Locks recordedKeyframesToEvents — the pure core behind committing a record-mode
// take (the accept path that USED to be a silent no-op). Headline contracts:
//   1. multi-channel keyframes ({beat,x,y}) become SEPARATE per-kind event series,
//      NOT one collapsed value (the dialog's SimplifiableKeyframe projection drops
//      y/rotation — committing from that would lose channels);
//   2. a typed 0 / negative position is preserved (falsy-zero);
//   3. consecutive samples become linear transition segments;
//   4. samples that round to the same beat tuple collapse — no zero-length [b,b]
//      transition is ever emitted.
//
// Pure (no DOM/store) so it runs under the node test env. grep recordedKeyframesToEvents.
// ============================================================

import { describe, it, expect } from "vitest";
import { recordedKeyframesToEvents } from "../utils/recordingCommit";
import { beatToFloat } from "../types/chart";

describe("recordedKeyframesToEvents — channels (D1)", () => {
  it("emits independent x and y series from multi-channel keyframes", () => {
    const events = recordedKeyframesToEvents(
      [
        { beat: 0, x: 0, y: -450 },
        { beat: 1, x: 100, y: 450 },
      ],
      null,
    );
    const xs = events.filter((e) => e.kind === "x");
    const ys = events.filter((e) => e.kind === "y");
    expect(xs).toHaveLength(1);
    expect(ys).toHaveLength(1);
    // The y channel is NOT dropped (the collapse bug) and its negative start is kept.
    expect(ys[0].value).toEqual({ transition: { start: -450, end: 450, easing: "linear" } });
  });

  it("skips channels with no samples", () => {
    const events = recordedKeyframesToEvents([{ beat: 0, x: 1 }, { beat: 1, x: 2 }], null);
    expect(events.every((e) => e.kind === "x")).toBe(true);
    expect(events).toHaveLength(1);
  });

  it("preserves a typed 0 position (no falsy-zero clobber)", () => {
    const events = recordedKeyframesToEvents([{ beat: 0, x: 0 }, { beat: 1, x: 0 }], null);
    expect(events).toHaveLength(1);
    expect(events[0].value).toEqual({ transition: { start: 0, end: 0, easing: "linear" } });
  });
});

describe("recordedKeyframesToEvents — segments (D1)", () => {
  it("builds N-1 linear transitions for N distinct samples (raw)", () => {
    const events = recordedKeyframesToEvents(
      [{ beat: 0, x: 0 }, { beat: 1, x: 100 }, { beat: 2, x: 200 }],
      null,
    );
    expect(events).toHaveLength(2);
    expect(beatToFloat(events[0].start_beat)).toBe(0);
    expect(beatToFloat(events[0].end_beat)).toBe(1);
    expect(beatToFloat(events[1].start_beat)).toBe(1);
    expect(beatToFloat(events[1].end_beat)).toBe(2);
    expect(events[1].value).toEqual({ transition: { start: 100, end: 200, easing: "linear" } });
  });

  it("emits a single constant event for a lone sample", () => {
    const events = recordedKeyframesToEvents([{ beat: 5, x: 42 }], null);
    expect(events).toHaveLength(1);
    expect(events[0].value).toEqual({ constant: 42 });
    expect(beatToFloat(events[0].start_beat)).toBe(5);
    expect(beatToFloat(events[0].end_beat)).toBe(5);
  });

  it("collapses samples that round to the same beat tuple (no zero-length event)", () => {
    // 1.00 and 1.01 both round to [1,0,1]; must not yield a [1,1] transition.
    const events = recordedKeyframesToEvents([{ beat: 1.0, x: 10 }, { beat: 1.01, x: 20 }], null);
    expect(events).toHaveLength(1);
    // Collapsed to the latest value as a constant pin (a start==end transition is forbidden).
    expect(events[0].value).toEqual({ constant: 20 });
  });

  it("reduces collinear samples when simplifying", () => {
    const samples = [{ beat: 0, x: 0 }, { beat: 1, x: 50 }, { beat: 2, x: 100 }];
    expect(recordedKeyframesToEvents(samples, null)).toHaveLength(2);
    const simplified = recordedKeyframesToEvents(samples, 0.5);
    // The middle point lies on the 0→100 line, so it drops to a single segment.
    expect(simplified).toHaveLength(1);
    expect(simplified[0].value).toEqual({ transition: { start: 0, end: 100, easing: "linear" } });
  });

  it("returns [] for an empty recording", () => {
    expect(recordedKeyframesToEvents([], null)).toEqual([]);
  });
});
