// ============================================================
// Entity Identity Utilities (notes, lines, events)
//
// Entities are stored in arrays (line.notes[], chart.lines[],
// line.events[]) and addressed by array index, but indices shift on
// insert/delete and chartStore re-sorts notes/events on every beat edit
// (sortNotes/sortEvents) and reorders lines. Stable ids provide
// references that survive those mutations.
//
// Used by: editorStore selection (selectedNoteUids/selectedEventIds/
// selectedLineId), groupStore line/note refs, drag refs, and the
// id->index resolvers in chartStore (grep resolveNoteIndex /
// resolveEventIndex / resolveLineIndex). Assigned on create/import/
// duplicate; ensureEntityIds backfills any chart loaded from disk.
// ============================================================

import type { PhichainChart, Line } from "../types/chart";

/** Generate a new unique note ID */
export function generateNoteUid(): string {
  return crypto.randomUUID();
}

/** Generate a new unique line ID */
export function generateLineId(): string {
  return crypto.randomUUID();
}

/** Generate a new unique line-event ID */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Assign UIDs to all notes in the chart that don't have one.
 * Mutates the chart in-place (safe to call within Immer produce).
 *
 * Prefer ensureEntityIds() for new code — this notes-only helper is kept
 * for back-compat with existing callers.
 */
export function ensureNoteUids(chart: PhichainChart): void {
  for (const line of chart.lines) {
    for (const note of line.notes) {
      if (!note.uid) {
        note.uid = generateNoteUid();
      }
    }
  }
}

/**
 * Backfill stable ids on a single line + its notes + events (flat + layered)
 * that lack one. Mutates in place (safe within an Immer produce). Used by
 * chartStore when creating/duplicating lines.
 */
export function ensureLineIds(line: Line): void {
  if (!line.id) line.id = generateLineId();
  for (const note of line.notes) {
    if (!note.uid) note.uid = generateNoteUid();
  }
  for (const event of line.events) {
    if (!event.id) event.id = generateEventId();
  }
  if (line.event_layers) {
    for (const layer of line.event_layers) {
      for (const arr of [
        layer.move_x_events,
        layer.move_y_events,
        layer.rotate_events,
        layer.alpha_events,
        layer.speed_events,
      ]) {
        for (const event of arr) {
          if (!event.id) event.id = generateEventId();
        }
      }
    }
  }
}

/**
 * Backfill stable ids on every line, note, and line-event (flat + layered)
 * that lacks one. Mutates in place (safe within an Immer produce). Call on
 * load/import so selection-by-identity and group line refs have a handle
 * that survives sorts/reorders. Superset of ensureNoteUids.
 */
export function ensureEntityIds(chart: PhichainChart): void {
  for (const line of chart.lines) ensureLineIds(line);
}

/** Build a lookup map from line ID → line index. Rebuild on chart change. */
export function buildLineIdMap(chart: PhichainChart): Map<string, number> {
  const map = new Map<string, number>();
  for (let li = 0; li < chart.lines.length; li++) {
    const id = chart.lines[li].id;
    if (id) map.set(id, li);
  }
  return map;
}

/**
 * Build a lookup map from note UID → {lineIndex, noteIndex}.
 * Must be rebuilt whenever the chart structure changes.
 */
export function buildNoteUidMap(
  chart: PhichainChart,
): Map<string, { lineIndex: number; noteIndex: number }> {
  const map = new Map<string, { lineIndex: number; noteIndex: number }>();
  for (let li = 0; li < chart.lines.length; li++) {
    const line = chart.lines[li];
    for (let ni = 0; ni < line.notes.length; ni++) {
      const uid = line.notes[ni].uid;
      if (uid) {
        map.set(uid, { lineIndex: li, noteIndex: ni });
      }
    }
  }
  return map;
}
