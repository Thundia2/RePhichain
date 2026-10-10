// ============================================================
// Official (Phigros) format import/export — T2 / T7 / F8
//
// T2 (export): beat→official-time must walk the full bpm_list (timeAt) and
//   rescale by the base bpm, not a flat beat*60/1.875 — otherwise a mid-song
//   bpm change exports every later note at the wrong time. Mirrors official.rs
//   `normalize_beat(bpm,beat)*60/1.875`.
// T7 (import): each official line's `time` is in its own line-bpm units; the
//   importer scales by globalBpm/lineBpm so a line with a different bpm lands at
//   the right beat. Identity for the common single-bpm chart.
// F8 (export): layered (RPE) X/Y collapses by SUMMING per-layer samples; the old
//   code read one covering event from the concatenated layer list and dropped
//   every layer but the first.
//
// grep T2 / T7 / F8.
// ============================================================

import { describe, it, expect } from "vitest";
import { convertPhichainToOfficial } from "../utils/officialExport";
import { convertOfficialToPhichain } from "../utils/officialImport";
import { CANVAS_WIDTH } from "../types/chart";
import type { PhichainChart, Beat } from "../types/chart";

function parse(json: string) {
  return JSON.parse(json) as {
    judgeLineList: Array<{
      notesAbove: Array<{ time: number; floorPosition: number }>;
      judgeLineMoveEvents: Array<{ start: number; end: number; start2: number }>;
    }>;
  };
}

describe("official export — bpm-normalized time (T2)", () => {
  it("single-bpm chart: identity with the old beat*60/1.875", () => {
    const chart = {
      format: 1, offset: 0,
      bpm_list: [{ beat: [0, 0, 1] as Beat, bpm: 120 }],
      lines: [{
        name: "L", notes: [{ kind: "tap", above: true, beat: [8, 0, 1] as Beat, x: 0, speed: 10 }],
        events: [], children: [], curve_note_tracks: [],
      }],
    } as unknown as PhichainChart;
    const out = parse(convertPhichainToOfficial(chart));
    // beat 8 @ 120bpm = 4s; 4 * 120/1.875 = 256 = 8*32 (old flat value).
    expect(out.judgeLineList[0].notesAbove[0].time).toBeCloseTo(256, 3);
  });

  it("mid-song bpm change: later note exports at the real (normalized) time", () => {
    const chart = {
      format: 1, offset: 0,
      bpm_list: [
        { beat: [0, 0, 1] as Beat, bpm: 120 },
        { beat: [4, 0, 1] as Beat, bpm: 240 },
      ],
      lines: [{
        name: "L", notes: [{ kind: "tap", above: true, beat: [8, 0, 1] as Beat, x: 0, speed: 10 }],
        events: [], children: [], curve_note_tracks: [],
      }],
    } as unknown as PhichainChart;
    const out = parse(convertPhichainToOfficial(chart));
    // beats 0-4 @120 = 2s, 4-8 @240 = 1s → 3s; 3 * 120/1.875 = 192 (NOT 8*32=256).
    expect(out.judgeLineList[0].notesAbove[0].time).toBeCloseTo(192, 3);
  });
});

describe("official export — additive layer sum for X/Y (F8)", () => {
  it("sums per-layer X instead of taking one covering event", () => {
    const xEvent = (v: number) => ({
      kind: "x", start_beat: [0, 0, 1] as Beat, end_beat: [4, 0, 1] as Beat, value: { constant: v },
    });
    const emptyLayer = () => ({
      move_x_events: [], move_y_events: [], rotate_events: [], alpha_events: [], speed_events: [],
    });
    const chart = {
      format: 1, offset: 0,
      bpm_list: [{ beat: [0, 0, 1] as Beat, bpm: 120 }],
      lines: [{
        name: "L", notes: [], events: [], children: [], curve_note_tracks: [],
        event_layers: [
          { ...emptyLayer(), move_x_events: [xEvent(100)] },
          { ...emptyLayer(), move_x_events: [xEvent(50)] },
        ],
      }],
    } as unknown as PhichainChart;
    const out = parse(convertPhichainToOfficial(chart));
    const move = out.judgeLineList[0].judgeLineMoveEvents[0];
    // 100 + 50 = 150 summed → normalized; the old code gave just 100.
    expect(move.start).toBeCloseTo(150 / CANVAS_WIDTH + 0.5, 5);
    expect(move.start).not.toBeCloseTo(100 / CANVAS_WIDTH + 0.5, 5);
  });
});

describe("official import — per-line bpm scale (T7)", () => {
  it("scales a line whose bpm differs from the base line", () => {
    const note = (time: number) => ({ type: 1, time, holdTime: 0, positionX: 9, speed: 1, floorPosition: 0 });
    const emptyLine = (bpm: number, t: number) => ({
      bpm,
      judgeLineMoveEvents: [], judgeLineRotateEvents: [], judgeLineDisappearEvents: [],
      speedEvents: [], notesAbove: [note(t)], notesBelow: [],
    });
    const official = JSON.stringify({
      formatVersion: 3, offset: 0,
      // line0 = base bpm 120, line1 = 240. Same official time 64 on each.
      judgeLineList: [emptyLine(120, 64), emptyLine(240, 64)],
    });
    const chart = convertOfficialToPhichain(official);
    const beatOf = (b: Beat) => b[0] + b[1] / b[2];
    const beat0 = beatOf(chart.lines[0].notes[0].beat);
    const beat1 = beatOf(chart.lines[1].notes[0].beat);
    // time 64 @120 (base) → beat 2.0; @240 → scaled by 120/240 → beat 1.0.
    expect(beat0).toBeCloseTo(2.0, 5);
    expect(beat1).toBeCloseTo(1.0, 5);
  });
});
