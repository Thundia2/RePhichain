// ============================================================
// Chart Store — Undo Transaction Tests (finding L1)
//
// Validates the transaction batching primitive in chartStore.ts:
//   - mutations inside transaction() collapse into ONE undo entry
//   - a single undo reverts the whole gesture
//   - nested transactions still produce one entry
//   - an empty transaction produces no entry and resets depth
//   - setMeta is excluded from undo history (finding S6) but marks dirty
//   - outside a transaction every mutation is its own entry (unchanged)
//
// Depends on: src/stores/chartStore.ts (transaction/beginTransaction/
// endTransaction, pushHistory). grep `_txnDepth` for the implementation.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { useChartStore } from "../stores/chartStore";
import type { LineEvent, LineEventKind } from "../types/chart";

function ev(kind: LineEventKind, beat: number): LineEvent {
  return {
    kind,
    start_beat: [beat, 0, 1],
    end_beat: [beat, 0, 1],
    value: { constant: 0 },
  };
}

function resetStore() {
  useChartStore.setState({
    chart: {
      format: 1,
      offset: 0,
      bpm_list: [{ beat: [0, 0, 1], bpm: 120 }],
      lines: [{ name: "L1", notes: [], events: [], children: [], curve_note_tracks: [] }],
    },
    meta: { composer: "", charter: "", illustrator: "", name: "", level: "" },
    _past: [],
    _future: [],
    _pastSeqs: [],
    _futureSeqs: [],
    _txnDepth: 0,
    _txnSnapshot: null,
    _txnDidPush: false,
    isDirty: false,
  });
}

describe("chartStore undo transactions (L1)", () => {
  beforeEach(resetStore);

  it("coalesces multiple mutations into a single undo entry", () => {
    const cs = useChartStore;
    expect(cs.getState()._past.length).toBe(0);

    cs.getState().transaction(() => {
      cs.getState().addEvent(0, ev("x", 0));
      cs.getState().addEvent(0, ev("y", 0));
      cs.getState().editLine(0, { name: "renamed" });
    });

    expect(cs.getState()._past.length).toBe(1);
    expect(cs.getState().chart.lines[0].events.length).toBe(2);
    expect(cs.getState().chart.lines[0].name).toBe("renamed");

    // A single undo reverts the entire gesture back to the pre-transaction state.
    cs.getState().undo();
    expect(cs.getState().chart.lines[0].events.length).toBe(0);
    expect(cs.getState().chart.lines[0].name).toBe("L1");
  });

  it("nested transactions still produce one entry", () => {
    const cs = useChartStore;
    cs.getState().transaction(() => {
      cs.getState().addEvent(0, ev("x", 0));
      cs.getState().transaction(() => {
        cs.getState().addEvent(0, ev("y", 0));
      });
      cs.getState().addEvent(0, ev("rotation", 0));
    });
    expect(cs.getState()._past.length).toBe(1);
    expect(cs.getState().chart.lines[0].events.length).toBe(3);
    expect(cs.getState()._txnDepth).toBe(0);
  });

  it("an empty transaction creates no undo entry and resets depth", () => {
    const cs = useChartStore;
    const before = cs.getState()._past.length;
    cs.getState().transaction(() => {});
    expect(cs.getState()._past.length).toBe(before);
    expect(cs.getState()._txnDepth).toBe(0);
    expect(cs.getState()._txnSnapshot).toBeNull();
  });

  it("excludes setMeta from undo history but marks dirty (S6)", () => {
    const cs = useChartStore;
    const before = cs.getState()._past.length;
    cs.getState().setMeta({ name: "Song" });
    expect(cs.getState()._past.length).toBe(before);
    expect(cs.getState().meta.name).toBe("Song");
    expect(cs.getState().isDirty).toBe(true);
  });

  it("without a transaction each mutation is its own undo entry", () => {
    const cs = useChartStore;
    cs.getState().addEvent(0, ev("x", 0));
    cs.getState().addEvent(0, ev("y", 0));
    expect(cs.getState()._past.length).toBe(2);
  });
});
