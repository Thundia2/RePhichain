// ============================================================
// Chart Store — markCleanIf in-flight-save race (finding F2)
//
// Locks the dirty-token primitive that makes saving race-safe. A save captures
// _dirtySeq BEFORE its async write, then clears isDirty via markCleanIf(token)
// ONLY if the token still matches — i.e. nothing edited the chart/meta during
// the write. The old code blind-cleared isDirty, so an edit made while the save
// was in flight was clobbered as "saved" and silently lost.
//
// EVERY dirty-marking path must advance _dirtySeq (chart mutation via
// pushHistory, setMeta, undo, redo) or this guard has holes — these tests pin
// each path. grep markStateDirty / markCleanIf.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { useChartStore } from "../stores/chartStore";

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
    _dirtySeq: 0,
  });
}

describe("chartStore markCleanIf — in-flight-save race (F2)", () => {
  beforeEach(resetStore);

  it("clears dirty when no edit happened since the token was captured", () => {
    useChartStore.getState().setOffset(1);
    expect(useChartStore.getState().isDirty).toBe(true);

    const token = useChartStore.getState()._dirtySeq; // "save start"
    useChartStore.getState().markCleanIf(token); // "save resolved", nothing edited
    expect(useChartStore.getState().isDirty).toBe(false);
  });

  it("KEEPS dirty when an edit lands after the token (the race itself)", () => {
    useChartStore.getState().setOffset(1);
    const token = useChartStore.getState()._dirtySeq; // captured at save start

    // Simulate an edit during the in-flight async write:
    useChartStore.getState().setOffset(2);
    expect(useChartStore.getState().isDirty).toBe(true);

    // markCleanIf with the STALE token must NOT clear — the mid-save edit is unsaved.
    useChartStore.getState().markCleanIf(token);
    expect(useChartStore.getState().isDirty).toBe(true);

    // Clearing with the CURRENT token works (nothing edited since).
    useChartStore.getState().markCleanIf(useChartStore.getState()._dirtySeq);
    expect(useChartStore.getState().isDirty).toBe(false);
  });

  it("advances the token on a meta edit (meta is persisted now — R1)", () => {
    const before = useChartStore.getState()._dirtySeq;
    useChartStore.getState().setMeta({ name: "X" });
    expect(useChartStore.getState()._dirtySeq).toBeGreaterThan(before);
    expect(useChartStore.getState().isDirty).toBe(true);

    // A token captured BEFORE the meta edit must not clear dirty.
    useChartStore.getState().markCleanIf(before);
    expect(useChartStore.getState().isDirty).toBe(true);
  });

  it("advances the token on undo (a save racing an undo isn't clobbered)", () => {
    useChartStore.getState().setOffset(5);
    useChartStore.getState().markClean(); // pretend the prior state was saved
    expect(useChartStore.getState().isDirty).toBe(false);

    const t0 = useChartStore.getState()._dirtySeq;
    useChartStore.getState().undo();
    expect(useChartStore.getState().isDirty).toBe(true);
    expect(useChartStore.getState()._dirtySeq).toBeGreaterThan(t0);
  });

  it("unconditional markClean still clears regardless of token", () => {
    useChartStore.getState().setOffset(1);
    expect(useChartStore.getState().isDirty).toBe(true);
    useChartStore.getState().markClean();
    expect(useChartStore.getState().isDirty).toBe(false);
  });
});
