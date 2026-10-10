// ============================================================
// Official (Phigros) Format Exporter
//
// Converts PhichainChart into the Official Phigros JSON format.
// Outputs formatVersion 3 (separate X/Y move events).
//
// This is the inverse of officialImport.ts and a faithful port of
// phichain-chart/src/format/official.rs `from_primitive`.
//
// Official format key differences from phichain internal:
//   - Time is real time scaled to a single bpm: official.rs normalizes every beat
//     through the FULL bpm_list (mid-song bpm changes) then scales by the base
//     bpm — `normalize_beat(bpm,beat)*60/1.875` = `timeAt(beat)*bpm/1.875`
//     (finding T2). A flat beat*60/1.875 only held for single-bpm charts.
//   - Each line has its own BPM field (we write the global/base bpm to all lines).
//   - Move events: v3 uses separate start/start2/end/end2 for X/Y.
//   - Note X: mapped from -675..675 canvas to 0-18 range.
//   - Opacity: 0-1 (phichain uses 0-255).
//   - Speed events have a single "value" (not start/end transition); they tile
//     contiguously and carry a cumulative floorPosition in official units
//     (finding F6). Notes carry their own floorPosition too.
//   - All events use linear easing only (easing info is dropped).
//   - Hold note speeds are baked: speed *= lineSpeed / 9.0 * 2.0.
//   - Layered (RPE) X/Y is collapsed by SUMMING per-layer samples (finding F8) —
//     concatenating layers and reading one covering event dropped every layer but
//     the first.
//
// grep T2 / F6 / F8.
// ============================================================

import type { PhichainChart, Line, Note, LineEvent, LineEventKind, Beat } from "../types/chart";
import { CANVAS_WIDTH, CANVAS_HEIGHT, beatToFloat } from "../types/chart";
import { collectKindEvents, isLayerCoreKind, lineHasLayers, getLayerEvents } from "./eventRouting";
import { BpmList } from "./bpmList";

// ============================================================
// Conversion Helpers
// ============================================================

/** Map NoteKind to Official note type number */
function kindToNoteType(kind: string): number {
  switch (kind) {
    case "tap": return 1;
    case "drag": return 2;
    case "hold": return 3;
    case "flick": return 4;
    default: return 1;
  }
}

/** Get the numeric value from a LineEvent (start value for constants, or specified) */
function getEventStartValue(event: LineEvent): number {
  if ("constant" in event.value) return event.value.constant;
  if ("transition" in event.value) return event.value.transition.start;
  return 0;
}

function getEventEndValue(event: LineEvent): number {
  if ("constant" in event.value) return event.value.constant;
  if ("transition" in event.value) return event.value.transition.end;
  return 0;
}

// ============================================================
// Flatten Event Layers
// ============================================================

/** Collect all events of a given kind from both flat events and event layers,
 *  concatenated and sorted by start beat. Delegates the flat-vs-layers decision
 *  to the shared collectKindEvents (finding L3). Used for rotation/opacity/speed
 *  (emitted per-event) and for the hold-speed-baking lookup. */
function collectEvents(line: Line, kind: LineEventKind): LineEvent[] {
  const events = collectKindEvents(line, kind);
  events.sort((a, b) => beatToFloat(a.start_beat) - beatToFloat(b.start_beat));
  return events;
}

/** The per-LAYER event arrays for a core kind on a layered chart (one entry per
 *  layer), else a single-element array of the flat-filtered events. Move-event
 *  export (F8) sums these per-layer samples so additive RPE layers aren't
 *  collapsed to a single layer. Each returned array is sorted by start beat. */
function collectKindLayers(line: Line, kind: LineEventKind): LineEvent[][] {
  let layers: LineEvent[][];
  if (isLayerCoreKind(kind) && lineHasLayers(line)) {
    layers = line.event_layers!.map((layer) => (getLayerEvents(layer, kind) ?? []).slice());
  } else {
    layers = [line.events.filter((e) => e.kind === kind)];
  }
  for (const arr of layers) {
    arr.sort((a, b) => beatToFloat(a.start_beat) - beatToFloat(b.start_beat));
  }
  return layers;
}

// ============================================================
// Speed Lookup
// ============================================================

/** Find the effective speed at a given beat from the speed events */
function getSpeedAtBeat(speedEvents: LineEvent[], beat: number): number {
  let speed = 1;
  for (const event of speedEvents) {
    const startBeat = beatToFloat(event.start_beat);
    if (startBeat > beat) break;
    speed = getEventEndValue(event);
  }
  return speed;
}

// ============================================================
// Main Export Function
// ============================================================

export function convertPhichainToOfficial(chart: PhichainChart): string {
  const globalBpm = chart.bpm_list.length > 0 ? chart.bpm_list[0].bpm : 120;

  // T2: real-time-normalized beat→official-time. timeAtFloat walks the full
  // bpm_list, so mid-song bpm changes export at the correct time; *globalBpm/1.875
  // rescales to the official "1.875 units per second at base bpm" tick. Identity
  // with the old beat*60/1.875 for a single-bpm chart.
  const bpmList = new BpmList(chart.bpm_list);
  const toTimeF = (beatVal: number) => bpmList.timeAtFloat(beatVal) * globalBpm / 1.875;
  const toTime = (beat: Beat) => toTimeF(beatToFloat(beat));

  const judgeLineList = chart.lines.map((line) => {
    // Collect events by kind
    const rotateEvents = collectEvents(line, "rotation");
    const opacityEvents = collectEvents(line, "opacity");
    const speedEvents = collectEvents(line, "speed");

    // F8: build move events by SUMMING per-layer X/Y samples (additive RPE model).
    const xLayers = collectKindLayers(line, "x");
    const yLayers = collectKindLayers(line, "y");
    const judgeLineMoveEvents = buildMoveEvents(xLayers, yLayers, toTimeF);

    // Build rotation events
    const judgeLineRotateEvents = rotateEvents.map((event) => ({
      startTime: toTime(event.start_beat),
      endTime: toTime(event.end_beat),
      start: getEventStartValue(event),
      end: getEventEndValue(event),
    }));

    // Build opacity events (phichain 0-255 → official 0-1)
    const judgeLineDisappearEvents = opacityEvents.map((event) => ({
      startTime: toTime(event.start_beat),
      endTime: toTime(event.end_beat),
      start: Math.max(0, Math.min(1, getEventStartValue(event) / 255)),
      end: Math.max(0, Math.min(1, getEventEndValue(event) / 255)),
    }));

    // Build speed events: official value = phichain_speed * 2 / 9. floorPosition
    // is filled by the F6 pass below.
    const officialSpeedEvents = speedEvents.map((event) => ({
      startTime: toTime(event.start_beat),
      endTime: toTime(event.end_beat),
      value: getEventStartValue(event) * 2.0 / 9.0,
      floorPosition: 0,
    }));
    officialSpeedEvents.sort((a, b) => a.startTime - b.startTime);

    // F6: official-unit floorPosition (port of official.rs from_primitive). Each
    // speed event is rewritten to tile contiguously (end = next start, last 1e9)
    // and accumulates floor = Σ dt·value/bpm·1.875 in official units. The old
    // code used phichain speed and omitted the /bpm·1.875 factor.
    const len = officialSpeedEvents.length;
    let floorAccum = 0;
    for (let i = 0; i < len; i++) {
      const ev = officialSpeedEvents[i];
      const startTime = Math.max(0, ev.startTime);
      const endTime = i < len - 1 ? officialSpeedEvents[i + 1].startTime : 1e9;
      ev.startTime = startTime;
      ev.endTime = endTime;
      ev.floorPosition = floorAccum;
      floorAccum += (endTime - startTime) * ev.value / globalBpm * 1.875;
    }

    // F6: per-note floorPosition from the (now tiled) official speed events.
    const noteFloorPosition = (noteTime: number): number => {
      let v1 = 0, v2 = 0, v3 = 0;
      for (const ev of officialSpeedEvents) {
        if (noteTime > ev.endTime) continue;
        if (noteTime < ev.startTime) break;
        v1 = ev.floorPosition;
        v2 = ev.value;
        v3 = noteTime - ev.startTime;
      }
      return v1 + v2 * v3 / globalBpm * 1.875;
    };

    // Build notes — separate into above and below
    const notesAbove: ReturnType<typeof convertNote>[] = [];
    const notesBelow: ReturnType<typeof convertNote>[] = [];

    for (const note of line.notes) {
      // Skip fake notes — official format doesn't support them
      if (note.fake) continue;

      const converted = convertNote(note, speedEvents, toTime);
      converted.floorPosition = noteFloorPosition(converted.time);
      if (note.above) {
        notesAbove.push(converted);
      } else {
        notesBelow.push(converted);
      }
    }

    return {
      bpm: globalBpm,
      judgeLineMoveEvents,
      judgeLineRotateEvents,
      judgeLineDisappearEvents,
      speedEvents: officialSpeedEvents,
      notesAbove,
      notesBelow,
    };
  });

  const officialChart = {
    formatVersion: 3,
    offset: chart.offset,
    judgeLineList,
  };

  return JSON.stringify(officialChart, null, 2);
}

// ============================================================
// Move Event Builder (merges X and Y into v3 format)
// ============================================================

function buildMoveEvents(
  xLayers: LineEvent[][],
  yLayers: LineEvent[][],
  toTimeF: (beatVal: number) => number,
): Array<{ startTime: number; endTime: number; start: number; start2: number; end: number; end2: number }> {
  // Collect all unique beat boundaries across every layer of X and Y.
  const beatBoundaries = new Set<number>();
  for (const arr of xLayers) {
    for (const e of arr) {
      beatBoundaries.add(beatToFloat(e.start_beat));
      beatBoundaries.add(beatToFloat(e.end_beat));
    }
  }
  for (const arr of yLayers) {
    for (const e of arr) {
      beatBoundaries.add(beatToFloat(e.start_beat));
      beatBoundaries.add(beatToFloat(e.end_beat));
    }
  }

  const sortedBeats = Array.from(beatBoundaries).sort((a, b) => a - b);

  // F8: value at a beat = SUM over layers of that layer's covering-event value.
  const sumLayers = (layers: LineEvent[][], beat: number) =>
    layers.reduce((acc, arr) => acc + sampleEventValue(arr, beat), 0);

  if (sortedBeats.length < 2) {
    // Fallback: single constant event from the value at beat 0 (or the lone bound).
    const b = sortedBeats.length === 1 ? sortedBeats[0] : 0;
    const xVal = sumLayers(xLayers, b);
    const yVal = sumLayers(yLayers, b);
    return [{
      startTime: 0,
      endTime: 1e9,
      start: xToNormalized(xVal),
      start2: yToNormalized(yVal),
      end: xToNormalized(xVal),
      end2: yToNormalized(yVal),
    }];
  }

  const result: Array<{ startTime: number; endTime: number; start: number; start2: number; end: number; end2: number }> = [];

  for (let i = 0; i < sortedBeats.length - 1; i++) {
    const startBeat = sortedBeats[i];
    const endBeat = sortedBeats[i + 1];

    const xStart = sumLayers(xLayers, startBeat);
    const xEnd = sumLayers(xLayers, endBeat);
    const yStart = sumLayers(yLayers, startBeat);
    const yEnd = sumLayers(yLayers, endBeat);

    result.push({
      startTime: toTimeF(startBeat),
      endTime: toTimeF(endBeat),
      start: xToNormalized(xStart),
      start2: yToNormalized(yStart),
      end: xToNormalized(xEnd),
      end2: yToNormalized(yEnd),
    });
  }

  return result;
}

/** Convert phichain X (-675..675) to official normalized (0-1) */
function xToNormalized(x: number): number {
  return x / CANVAS_WIDTH + 0.5;
}

/** Convert phichain Y (-450..450) to official normalized (0-1) */
function yToNormalized(y: number): number {
  return y / CANVAS_HEIGHT + 0.5;
}

/** Sample one event array's value at a beat (linear interpolation within the
 *  covering event; outgoing event wins exactly at a shared boundary, so X/Y
 *  discontinuities are preserved). Inherits the first event's start before it and
 *  the last event's end after it. F8 sums this across layers. */
function sampleEventValue(events: LineEvent[], beat: number): number {
  if (events.length === 0) return 0;

  for (const event of events) {
    const startBeat = beatToFloat(event.start_beat);
    const endBeat = beatToFloat(event.end_beat);

    if (beat >= startBeat && beat <= endBeat) {
      const startVal = getEventStartValue(event);
      const endVal = getEventEndValue(event);
      if (Math.abs(endBeat - startBeat) < 1e-9) return startVal;
      const t = (beat - startBeat) / (endBeat - startBeat);
      return startVal + (endVal - startVal) * t;
    }
  }

  // Before first event — use first event's start value
  const firstBeat = beatToFloat(events[0].start_beat);
  if (beat < firstBeat) return getEventStartValue(events[0]);

  // After last event — use last event's end value
  return getEventEndValue(events[events.length - 1]);
}

// ============================================================
// Note Conversion
// ============================================================

function convertNote(
  note: Note,
  speedEvents: LineEvent[],
  toTime: (beat: Beat) => number,
): {
  type: number;
  time: number;
  holdTime: number;
  positionX: number;
  speed: number;
  floorPosition: number;
} {
  const time = toTime(note.beat);
  let holdTime = 0;
  if (note.kind === "hold" && note.hold_beat) {
    // hold_beat is a duration; convert as (end - start) in official time so a
    // mid-hold bpm change is honored (T2). official.rs: time(beat+hold)-time(beat).
    const endBeat: Beat = [
      note.beat[0] + note.hold_beat[0],
      note.beat[1] * note.hold_beat[2] + note.hold_beat[1] * note.beat[2],
      note.beat[2] * note.hold_beat[2],
    ];
    holdTime = toTime(endBeat) - time;
  }

  // Convert X from -675..675 canvas to 0-18 range
  const positionX = note.x / CANVAS_WIDTH * 18.0;

  // Bake speed for hold notes: official holds multiply by line speed
  let speed = note.speed;
  if (note.kind === "hold") {
    const noteBeat = beatToFloat(note.beat);
    const lineSpeed = getSpeedAtBeat(speedEvents, noteBeat);
    if (lineSpeed !== 0) {
      speed *= lineSpeed / 9.0 * 2.0;
    }
  }

  return {
    type: kindToNoteType(note.kind),
    time,
    holdTime,
    positionX,
    speed,
    floorPosition: 0, // filled by the F6 per-note pass in the caller
  };
}
