// ============================================================
// Event Routing (flat line.events <-> RPE event_layers) — finding L3
//
// Both `line.events` (flat) and `line.event_layers` exist as writable truth.
// The evaluator (canvas/events.ts `evaluateLineEventsWithLayers`) reads the 5
// CORE kinds (x / y / rotation / opacity / speed) from `event_layers` when
// layers exist — and IGNORES flat core-kind events in that case. RPE export
// (rpeExport.ts) likewise prefers layers. So an editor that writes a core event
// to flat `line.events` on a layered chart produces an edit that is invisible
// in preview AND dropped on export. (Virtually every RPE/.pez import sets
// `event_layers`, so this hits almost all imported charts.)
//
// This module is the single source of truth for "which array does a
// (line, kind) live in." It is consumed by:
//   - chartStore routed writes: addEventRouted / editEventById /
//     replaceEventById / removeEventsById (grep those names)
//   - KeyframeBar / KeyframeStrip diamond-strip display (resolveActive*)
//   - officialExport / pecExport (collectKindEvents) — kills the kind->field
//     switch each used to inline
//
// Extended kinds (scale_x / scale_y / color / text / incline / gif) are NOT
// layered in RPE; the evaluator reads them from flat even on layered charts, so
// they ALWAYS route to flat here. Pure module (types-only import) — safe to
// import from stores without a cycle.
// ============================================================

import type { Line, LineEvent, LineEventKind, EventLayer } from "../types/chart";

/** The 5 core event kinds RPE stores in additive event layers, in the canonical
 *  field order (move_x, move_y, rotate, alpha, speed). */
export const LAYER_CORE_KINDS: readonly LineEventKind[] = ["x", "y", "rotation", "opacity", "speed"];

/** Whether a kind lives in event layers (the 5 core kinds) vs. flat-only
 *  (scale_x/scale_y/color/text/incline/gif). */
export function isLayerCoreKind(kind: LineEventKind): boolean {
  return kind === "x" || kind === "y" || kind === "rotation" || kind === "opacity" || kind === "speed";
}

/** Whether a line uses RPE event layers (takes precedence over flat events). */
export function lineHasLayers(line: Line): boolean {
  return !!line.event_layers && line.event_layers.length > 0;
}

/**
 * The events array for a given kind within one event layer, or `null` for a
 * non-core kind (which has no layer field). Returning the live array reference
 * means callers inside an Immer producer can push/splice/sort it directly.
 *
 * This is the kind->field map that KeyframeBar, KeyframeStrip, officialExport
 * and pecExport used to each duplicate.
 */
export function getLayerEvents(layer: EventLayer, kind: LineEventKind): LineEvent[] | null {
  switch (kind) {
    case "x": return layer.move_x_events;
    case "y": return layer.move_y_events;
    case "rotation": return layer.rotate_events;
    case "opacity": return layer.alpha_events;
    case "speed": return layer.speed_events;
    default: return null;
  }
}

/** Where a write for (line, eventKind) should land. */
export type EventRouteTarget = { kind: "flat" } | { kind: "layer"; layerIndex: number };

/**
 * Decide the destination array for a write of `eventKind` on `line`.
 *
 * `layerIndex` mirrors editorStore.eventEditorActiveLayer:
 *   -1        → explicit "Flat" pill: write flat (used to reach extended events)
 *   0..4      → that layer
 *   undefined → "auto": layer 0 on a layered chart (so the edit is visible)
 *
 * Routes to flat when the kind is non-core, the line has no layers, or the
 * caller forced flat (-1). Otherwise routes to the requested layer, clamped
 * into the existing layer range so a stale pill index can't silently drop the
 * write (the old per-component `addEventToLayer` calls no-op'd on out-of-range).
 */
export function routeEventTarget(line: Line, eventKind: LineEventKind, layerIndex?: number): EventRouteTarget {
  if (!isLayerCoreKind(eventKind) || !lineHasLayers(line) || layerIndex === -1) {
    return { kind: "flat" };
  }
  const layers = line.event_layers!;
  let li = layerIndex ?? 0;
  if (li < 0) li = 0;
  if (li >= layers.length) li = layers.length - 1;
  return { kind: "layer", layerIndex: li };
}

/**
 * All events of a kind across the whole line, honoring layers: sums (concats)
 * every layer's kind-array for core kinds on a layered chart, else returns a
 * flat-filtered copy. For export and evaluation-style reads that need the full
 * picture (officialExport/pecExport). Returns a fresh array — safe to sort.
 */
export function collectKindEvents(line: Line, kind: LineEventKind): LineEvent[] {
  if (isLayerCoreKind(kind) && lineHasLayers(line)) {
    const out: LineEvent[] = [];
    for (const layer of line.event_layers!) {
      const arr = getLayerEvents(layer, kind);
      if (arr) out.push(...arr);
    }
    return out;
  }
  return line.events.filter((e) => e.kind === kind);
}

/**
 * The events of a kind the editor is currently EDITING — a single active layer
 * (activeLayer >= 0 on a layered chart) or flat. Mirrors routeEventTarget so
 * the array a consumer hit-tests against is the same one a routed write mutates.
 * For core kinds on a layered chart this returns the LIVE layer array; otherwise
 * a flat-filtered copy (read-only is fine — consumers locate events by identity).
 */
export function resolveActiveKindEvents(line: Line, kind: LineEventKind, activeLayer: number): LineEvent[] {
  if (isLayerCoreKind(kind) && lineHasLayers(line) && activeLayer >= 0) {
    const layer = line.event_layers![activeLayer];
    if (layer) return getLayerEvents(layer, kind) ?? [];
  }
  return line.events.filter((e) => e.kind === kind);
}

/**
 * The flat list the KeyframeBar / KeyframeStrip diamond strip displays: the
 * active layer's 5 core arrays concatenated (when activeLayer >= 0 and the
 * layer exists), else flat `line.events`. Replaces the hand-inlined concat both
 * components duplicated.
 */
export function resolveActiveDisplayEvents(line: Line, activeLayer: number): LineEvent[] {
  if (activeLayer >= 0 && line.event_layers && line.event_layers[activeLayer]) {
    const layer = line.event_layers[activeLayer];
    return [
      ...layer.move_x_events,
      ...layer.move_y_events,
      ...layer.rotate_events,
      ...layer.alpha_events,
      ...layer.speed_events,
    ];
  }
  return line.events;
}

/**
 * Find an event by its stable id (finding L2) anywhere on a line — flat array
 * or any layer's kind-array. Used by drag refs that need to re-read an event
 * mid-gesture without knowing whether it lives flat or layered.
 */
export function findEventInLine(line: Line, eventId: string): LineEvent | null {
  const flat = line.events.find((e) => e.id === eventId);
  if (flat) return flat;
  if (line.event_layers) {
    for (const layer of line.event_layers) {
      for (const kind of LAYER_CORE_KINDS) {
        const arr = getLayerEvents(layer, kind);
        if (!arr) continue;
        const hit = arr.find((e) => e.id === eventId);
        if (hit) return hit;
      }
    }
  }
  return null;
}
