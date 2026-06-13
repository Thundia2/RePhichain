// ============================================================
// Evaluator defaults + upstream tiebreak + baseline removal (finding L4)
//
// Locks the behavior that the L4 remediation depends on:
//   - DEFAULT_LINE_STATE is the real per-kind fallback (opacity 1 VISIBLE,
//     speed 10), reachable now that baselines are gone.
//   - The affecting-vs-affecting tie breaks by VALUE and the inherited tie by
//     end_beat, exactly mirroring upstream phichain-chart event.rs:350-374
//     (Unaffected < Inherited < Affecting; Affecting ties a.total_cmp(b);
//     Inherited ties by `from` = end_beat). The old code broke BOTH by end_beat
//     — the baseline-shadow bug.
//   - The layered (additive) path falls back to defaults when no layer
//     contributes a kind, and preserves a legitimately-summed speed of 0 (the
//     T4 `speed || 10` bug).
//   - createDefaultLine / addLine produce a baseline-free line.
//
// grep DEFAULT_LINE_STATE / bestKey / routeEventTarget.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  DEFAULT_LINE_STATE,
  evaluateLineEvents,
  evaluateLineEventsWithLayers,
  getFirstAppearanceBeat,
} from "../canvas/events";
import { useChartStore } from "../stores/chartStore";
import type { LineEvent, LineEventKind, EventLayer } from "../types/chart";

/** A constant event of `kind` spanning [start, end] with value `v`. */
function ev(kind: LineEventKind, start: number, end: number, v: number): LineEvent {
  return { kind, start_beat: [start, 0, 1], end_beat: [end, 0, 1], value: { constant: v } };
}

function layer(partial: Partial<EventLayer> = {}): EventLayer {
  return {
    move_x_events: [],
    move_y_events: [],
    rotate_events: [],
    alpha_events: [],
    speed_events: [],
    ...partial,
  };
}

describe("DEFAULT_LINE_STATE (L4)", () => {
  it("is visible (opacity 1) and speed 10 by default", () => {
    expect(DEFAULT_LINE_STATE.opacity).toBe(1);
    expect(DEFAULT_LINE_STATE.speed).toBe(10);
    expect(DEFAULT_LINE_STATE.x).toBe(0);
    expect(DEFAULT_LINE_STATE.y).toBe(0);
    expect(DEFAULT_LINE_STATE.rotation).toBe(0);
  });
});

describe("evaluateLineEvents fallback (L4)", () => {
  it("no events → visible, speed 10, at the origin", () => {
    const s = evaluateLineEvents([], 5);
    expect(s.opacity).toBe(1);
    expect(s.speed).toBe(10);
    expect(s.x).toBe(0);
    expect(s.rotation).toBe(0);
  });
});

describe("evaluateLineEvents tiebreak — upstream parity (L4)", () => {
  it("Affecting ties break by VALUE, not end_beat", () => {
    // A: spans far ([0,100]) but small value; B: spans short ([0,10]) but large.
    // At beat 5 both are affecting. Old code picked A (largest end_beat); the
    // upstream rule picks B (largest value).
    const a = ev("opacity", 0, 100, 50);
    const b = ev("opacity", 0, 10, 200);
    expect(evaluateLineEvents([a, b], 5).opacity).toBeCloseTo(200 / 255);
    // order-independent
    expect(evaluateLineEvents([b, a], 5).opacity).toBeCloseTo(200 / 255);
  });

  it("Inherited ties break by end_beat (later `from` wins), ignoring value", () => {
    // Both ended before beat 50 → both Inherited. A has the larger value but the
    // earlier end; the later-ending B wins per upstream `from` comparison.
    const a = ev("opacity", 0, 10, 200);
    const b = ev("opacity", 0, 20, 30);
    expect(evaluateLineEvents([a, b], 50).opacity).toBeCloseTo(30 / 255);
    expect(evaluateLineEvents([b, a], 50).opacity).toBeCloseTo(30 / 255);
  });

  it("Affecting always outranks Inherited, regardless of value", () => {
    const affecting = ev("opacity", 0, 10, 100); // covers beat 5
    const inherited = ev("opacity", 0, 3, 250); // ended at 3, larger value
    expect(evaluateLineEvents([affecting, inherited], 5).opacity).toBeCloseTo(100 / 255);
    expect(evaluateLineEvents([inherited, affecting], 5).opacity).toBeCloseTo(100 / 255);
  });
});

describe("evaluateLineEventsWithLayers (L4 + T4)", () => {
  it("no alpha/speed events anywhere → default-visible, speed 10", () => {
    const s = evaluateLineEventsWithLayers([], [layer()], 5);
    expect(s.opacity).toBe(1);
    expect(s.speed).toBe(10);
  });

  it("preserves a summed speed of 0 (T4: no longer `|| 10`)", () => {
    const s = evaluateLineEventsWithLayers([], [layer({ speed_events: [ev("speed", 0, 10, 0)] })], 5);
    expect(s.speed).toBe(0);
  });

  it("sums a core kind additively across layers", () => {
    const l0 = layer({ move_x_events: [ev("x", 0, 10, 100)] });
    const l1 = layer({ move_x_events: [ev("x", 0, 10, 100)] });
    expect(evaluateLineEventsWithLayers([], [l0, l1], 5).x).toBe(200);
  });

  it("alpha 255 in a layer → fully visible", () => {
    const s = evaluateLineEventsWithLayers([], [layer({ alpha_events: [ev("opacity", 0, 10, 255)] })], 5);
    expect(s.opacity).toBeCloseTo(1);
  });
});

describe("getFirstAppearanceBeat (L4)", () => {
  it("no opacity events → visible from beat 0 (was Infinity)", () => {
    expect(getFirstAppearanceBeat([])).toBe(0);
  });

  it("invisible-then-visible → start of the first opacity>0 event", () => {
    const events = [ev("opacity", 0, 10, 0), ev("opacity", 10, 20, 255)];
    expect(getFirstAppearanceBeat(events)).toBe(10);
  });
});

describe("baseline-free line creation (L4)", () => {
  it("addLine creates a line with no [0,1000] sentinel events", () => {
    useChartStore.setState({
      chart: { format: 1, offset: 0, bpm_list: [{ beat: [0, 0, 1], bpm: 120 }], lines: [] },
      meta: { composer: "", charter: "", illustrator: "", name: "", level: "" },
      _past: [], _future: [], _pastSeqs: [], _futureSeqs: [],
      _txnDepth: 0, _txnSnapshot: null, _txnDidPush: false, isDirty: false,
    });
    useChartStore.getState().addLine();
    const line = useChartStore.getState().chart.lines[0];
    expect(line.events).toEqual([]);
    // and it evaluates as visible via the default fallback
    expect(evaluateLineEventsWithLayers(line.events, line.event_layers, 5).opacity).toBe(1);
  });
});
