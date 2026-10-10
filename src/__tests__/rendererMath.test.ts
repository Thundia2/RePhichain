// ============================================================
// distanceAt overlap (C4) + tween easing-clip renormalization (C8)
//
// C4: overlapping speed segments (sorted by startTime, an earlier segment ends
//   LATER than a following one) must not rewind the integration frontier. The
//   old `lastTime = seg.endTime` rewound to the shorter segment's end and then
//   re-integrated [end, frontier] at the wrong trailing speed — notes teleported
//   and distanceAt went non-monotonic. The fix advances with Math.max and only
//   adopts a segment's trailing speed when it reaches/extends the frontier.
//
// C8: RPE "partial easing" (easing_left/easing_right) clips the curve to a
//   sub-range AND renormalizes the output so the transition still spans
//   start→end exactly: (f(clip)-f(left))/(f(right)-f(left)). Without the rescale
//   a clipped event jumped to start+(end-start)*f(left) on its first frame. For
//   the default left=0/right=1 it is identity.
//
// grep C4 / C8 / easing_left.
// ============================================================

import { describe, it, expect } from "vitest";
import { distanceAt } from "../canvas/events";
import { tween } from "../canvas/easings";
import type { LineEvent, Beat } from "../types/chart";

/** Constant speed event spanning [start,end] (beats) with value v. */
function speed(start: number, end: number, v: number): LineEvent {
  return { kind: "speed", start_beat: [start, 0, 1], end_beat: [end, 0, 1], value: { constant: v } };
}

/** Test bpmTimeAt: treat beat[0] as seconds directly so segment times are explicit. */
const beatAsSeconds = (b: Beat) => b[0];

describe("distanceAt — overlapping speed segments (C4)", () => {
  it("does not rewind the frontier or double-count an overlapped segment", () => {
    // A[0,10]@10 dominates; B[2,5]@2 is fully shadowed (ends before A). Distance
    // at t=12 = 10·12 = 120 (constant 10 throughout, trailing speed stays 10).
    // The old code rewound to 5 and re-counted [5,12]@2 → 114 (wrong).
    const events = [speed(0, 10, 10), speed(2, 5, 2)];
    expect(distanceAt(events, 12, beatAsSeconds)).toBeCloseTo(120);
  });

  it("is monotonically non-decreasing across the overlap boundary", () => {
    const events = [speed(0, 10, 10), speed(2, 5, 2)];
    let prev = -Infinity;
    for (let t = 0; t <= 12; t += 0.5) {
      const d = distanceAt(events, t, beatAsSeconds);
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
  });

  it("still tiles non-overlapping segments correctly", () => {
    // [0,4]@10 then [4,8]@20 → 4·10 + 4·20 = 120 at t=8.
    const events = [speed(0, 4, 10), speed(4, 8, 20)];
    expect(distanceAt(events, 8, beatAsSeconds)).toBeCloseTo(120);
  });
});

describe("tween — easing-clip renormalization (C8)", () => {
  it("clipped transition still starts exactly at `start`", () => {
    // Old code: clippedT=0.5 → eased 0.5 → 50 at t=0. Renormalized → 0.
    expect(tween(0, 100, 0, "linear", 0.5, 1.0)).toBeCloseTo(0);
  });

  it("clipped transition still ends exactly at `end`", () => {
    expect(tween(0, 100, 1, "linear", 0.5, 1.0)).toBeCloseTo(100);
  });

  it("linear clip stays linear in the middle", () => {
    expect(tween(0, 100, 0.5, "linear", 0.5, 1.0)).toBeCloseTo(50);
  });

  it("non-linear clip renormalizes endpoints to start/end", () => {
    expect(tween(0, 1, 0, "ease_in_quad", 0.5, 1.0)).toBeCloseTo(0);
    expect(tween(0, 1, 1, "ease_in_quad", 0.5, 1.0)).toBeCloseTo(1);
  });

  it("default left=0/right=1 is identity (no behavior change for normal events)", () => {
    expect(tween(0, 100, 0.3, "linear")).toBeCloseTo(30);
    expect(tween(0, 100, 0.3, "ease_in_quad")).toBeCloseTo(9); // 0.3^2 = 0.09
  });
});
