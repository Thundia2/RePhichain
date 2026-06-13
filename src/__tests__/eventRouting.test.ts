// ============================================================
// Event Routing + chartStore routed writes (finding L3)
//
// Validates that editor writes land where evaluateLineEventsWithLayers READS:
//   - the pure routing helpers in utils/eventRouting.ts
//   - chartStore's addEventRouted / editEventById / replaceEventById /
//     removeEventsById
//
// The core invariant: on a layered (RPE-style) line a CORE-kind write goes into
// the active event layer's kind-array (not flat line.events, where it would be
// invisible in preview + dropped on export); extended kinds and non-layered
// lines stay flat. grep `routeEventTarget` / `addEventRouted`.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { useChartStore } from "../stores/chartStore";
import {
  routeEventTarget,
  collectKindEvents,
  resolveActiveKindEvents,
  findEventInLine,
  getLayerEvents,
  isLayerCoreKind,
} from "../utils/eventRouting";
import type { Line, LineEvent, LineEventKind, EventLayer } from "../types/chart";

function ev(kind: LineEventKind, beat: number, id?: string): LineEvent {
  return {
    ...(id ? { id } : {}),
    kind,
    start_beat: [beat, 0, 1],
    end_beat: [beat + 1, 0, 1],
    value: { constant: 0 },
  };
}

function emptyLayer(): EventLayer {
  return { move_x_events: [], move_y_events: [], rotate_events: [], alpha_events: [], speed_events: [] };
}

function flatLine(events: LineEvent[] = []): Line {
  return { name: "flat", notes: [], events, children: [], curve_note_tracks: [] };
}

function layeredLine(layers: EventLayer[]): Line {
  return { name: "layered", notes: [], events: [], children: [], curve_note_tracks: [], event_layers: layers };
}

describe("eventRouting helpers (L3)", () => {
  it("routeEventTarget: flat for a non-layered line", () => {
    expect(routeEventTarget(flatLine(), "x", 0)).toEqual({ kind: "flat" });
  });

  it("routeEventTarget: a layered core-kind write goes to the requested layer", () => {
    const line = layeredLine([emptyLayer(), emptyLayer()]);
    expect(routeEventTarget(line, "x", 1)).toEqual({ kind: "layer", layerIndex: 1 });
  });

  it("routeEventTarget: layerIndex -1 forces flat even on a layered line", () => {
    const line = layeredLine([emptyLayer()]);
    expect(routeEventTarget(line, "x", -1)).toEqual({ kind: "flat" });
  });

  it("routeEventTarget: extended kinds always route flat (not layered in RPE)", () => {
    const line = layeredLine([emptyLayer()]);
    expect(isLayerCoreKind("color")).toBe(false);
    expect(routeEventTarget(line, "color", 0)).toEqual({ kind: "flat" });
  });

  it("routeEventTarget: an out-of-range layer index is clamped into the existing range", () => {
    const line = layeredLine([emptyLayer()]); // only layer 0 exists
    expect(routeEventTarget(line, "speed", 4)).toEqual({ kind: "layer", layerIndex: 0 });
  });

  it("routeEventTarget: undefined layer auto-routes to layer 0 on a layered line", () => {
    const line = layeredLine([emptyLayer(), emptyLayer()]);
    expect(routeEventTarget(line, "opacity", undefined)).toEqual({ kind: "layer", layerIndex: 0 });
  });

  it("collectKindEvents: sums a core kind across all layers", () => {
    const l0 = emptyLayer(); l0.move_x_events.push(ev("x", 0));
    const l1 = emptyLayer(); l1.move_x_events.push(ev("x", 4));
    const line = layeredLine([l0, l1]);
    expect(collectKindEvents(line, "x").length).toBe(2);
  });

  it("collectKindEvents: reads extended kinds from flat even on a layered line", () => {
    const line = layeredLine([emptyLayer()]);
    line.events.push(ev("color", 0));
    expect(collectKindEvents(line, "color").length).toBe(1);
  });

  it("resolveActiveKindEvents: returns the live layer array for a core kind", () => {
    const l0 = emptyLayer(); l0.alpha_events.push(ev("opacity", 0));
    const line = layeredLine([l0]);
    const arr = resolveActiveKindEvents(line, "opacity", 0);
    expect(arr).toBe(l0.alpha_events); // same reference — writes mutate in place
  });

  it("findEventInLine: locates an event living in a layer by id", () => {
    const l0 = emptyLayer(); l0.rotate_events.push(ev("rotation", 0, "rot-1"));
    const line = layeredLine([l0]);
    expect(findEventInLine(line, "rot-1")?.kind).toBe("rotation");
    expect(findEventInLine(line, "missing")).toBeNull();
  });

  it("getLayerEvents: returns null for a non-core kind", () => {
    expect(getLayerEvents(emptyLayer(), "color")).toBeNull();
    expect(getLayerEvents(emptyLayer(), "x")).not.toBeNull();
  });
});

function resetStore(lines: Line[]) {
  useChartStore.setState({
    chart: { format: 1, offset: 0, bpm_list: [{ beat: [0, 0, 1], bpm: 120 }], lines },
    meta: { composer: "", charter: "", illustrator: "", name: "", level: "" },
    _past: [], _future: [], _pastSeqs: [], _futureSeqs: [],
    _txnDepth: 0, _txnSnapshot: null, _txnDidPush: false, isDirty: false,
  });
}

describe("chartStore routed event writes (L3)", () => {
  beforeEach(() => {
    // line 0: layered (one empty layer); line 1: flat
    resetStore([layeredLine([emptyLayer()]), flatLine()]);
  });

  it("addEventRouted: a core-kind write on a layered line lands in the layer, not flat", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("x", 0), 0);
    const line = useChartStore.getState().chart.lines[0];
    expect(line.event_layers![0].move_x_events.length).toBe(1);
    expect(line.events.length).toBe(0); // NOT flat
  });

  it("addEventRouted: an extended-kind write on a layered line lands in flat", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("color", 0), 0);
    const line = useChartStore.getState().chart.lines[0];
    expect(line.events.length).toBe(1);
    expect(line.event_layers![0].move_x_events.length).toBe(0);
  });

  it("addEventRouted: a write on a non-layered line lands in flat", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(1, ev("x", 0), 0);
    const line = useChartStore.getState().chart.lines[1];
    expect(line.events.length).toBe(1);
  });

  it("addEventRouted: assigns an id to the inserted layer event", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("speed", 0), 0);
    const inserted = useChartStore.getState().chart.lines[0].event_layers![0].speed_events[0];
    expect(typeof inserted.id).toBe("string");
    expect(inserted.id!.length).toBeGreaterThan(0);
  });

  it("editEventById: edits an event living in a layer", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("x", 0), 0);
    const id = useChartStore.getState().chart.lines[0].event_layers![0].move_x_events[0].id!;
    cs.editEventById(0, id, { value: { constant: 123 } });
    const after = useChartStore.getState().chart.lines[0].event_layers![0].move_x_events[0];
    expect((after.value as { constant: number }).constant).toBe(123);
  });

  it("replaceEventById: replaces a layered event with two in the same layer array", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("y", 0), 0);
    const id = useChartStore.getState().chart.lines[0].event_layers![0].move_y_events[0].id!;
    cs.replaceEventById(0, id, [ev("y", 0), ev("y", 2)]);
    const arr = useChartStore.getState().chart.lines[0].event_layers![0].move_y_events;
    expect(arr.length).toBe(2);
    // each replacement gets a fresh id, and the old id is gone
    expect(arr.every((e) => typeof e.id === "string")).toBe(true);
    expect(arr.some((e) => e.id === id)).toBe(false);
  });

  it("removeEventsById: removes a layered event located by id", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("rotation", 0), 0);
    const id = useChartStore.getState().chart.lines[0].event_layers![0].rotate_events[0].id!;
    cs.removeEventsById(0, [id]);
    expect(useChartStore.getState().chart.lines[0].event_layers![0].rotate_events.length).toBe(0);
  });

  it("routed writes are undoable as single entries", () => {
    const cs = useChartStore.getState();
    cs.addEventRouted(0, ev("x", 0), 0);
    expect(useChartStore.getState().chart.lines[0].event_layers![0].move_x_events.length).toBe(1);
    useChartStore.getState().undo();
    expect(useChartStore.getState().chart.lines[0].event_layers![0].move_x_events.length).toBe(0);
  });
});
