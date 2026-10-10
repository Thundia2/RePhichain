// ============================================================
// Selection Resolvers (finding L2 — selection-by-identity)
//
// editorStore stores selection as stable ids (selectedLineId,
// selectedNoteUids, selectedEventIds, multiSelectedLineIds) so a selection
// survives chartStore's sortNotes/sortEvents/reorderLines without rebinding
// to a different entity. This module bridges those ids to the array indices
// that most consumers work in:
//
//   - useSelected*Index(es)        React hooks; re-resolve when the selection
//                                  or chart.lines changes. Use in components.
//   - getSelected*Index(es)        imperative getters for non-React / event
//                                  handler code (read getState(), resolve fresh).
//   - select*ByIndex/toggle*ByIndex  write helpers: take the indices a caller
//                                  already has, map them to ids, store them.
//
// Resolution is cached in chartStore (resolveLineIndex / resolveNoteIndices /
// resolveEventIndices, keyed by array reference). Depends on editorStore
// (selection storage) + chartStore (the chart + resolvers). Nothing imports
// this at module scope except UI/handlers, so there is no store import cycle.
// grep `selectedNoteUids` for the storage, `ByIndex` for write call sites.
// ============================================================

import { useMemo } from "react";
import { useEditorStore } from "./editorStore";
import {
  useChartStore,
  resolveLineIndex,
  resolveNoteIndices,
  resolveEventIndices,
} from "./chartStore";

// ---- Imperative getters (read current state, resolve fresh) ----

/** Current selected line index, or null if nothing is selected or the line was deleted. */
export function getSelectedLineIndex(): number | null {
  const i = resolveLineIndex(useEditorStore.getState().selectedLineId);
  return i >= 0 ? i : null;
}

/** Indices of the currently selected notes within the selected line. */
export function getSelectedNoteIndices(): number[] {
  const li = getSelectedLineIndex();
  if (li == null) return [];
  return resolveNoteIndices(li, useEditorStore.getState().selectedNoteUids);
}

/** Indices of the currently selected events within the selected line's flat events. */
export function getSelectedEventIndices(): number[] {
  const li = getSelectedLineIndex();
  if (li == null) return [];
  return resolveEventIndices(li, useEditorStore.getState().selectedEventIds);
}

/** Indices of the multi-selected lines (batch line editing). */
export function getMultiSelectedLineIndices(): number[] {
  const ids = useEditorStore.getState().multiSelectedLineIds;
  const out: number[] = [];
  for (const id of ids) {
    const i = resolveLineIndex(id);
    if (i >= 0) out.push(i);
  }
  return out;
}

// ---- React hooks (reactive: re-resolve on selection OR chart change) ----

export function useSelectedLineIndex(): number | null {
  const id = useEditorStore((s) => s.selectedLineId);
  const lines = useChartStore((s) => s.chart.lines);
  return useMemo(() => {
    if (id == null) return null;
    const i = lines.findIndex((l) => l.id === id);
    return i >= 0 ? i : null;
  }, [id, lines]);
}

export function useSelectedNoteIndices(): number[] {
  const uids = useEditorStore((s) => s.selectedNoteUids);
  const lineId = useEditorStore((s) => s.selectedLineId);
  const lines = useChartStore((s) => s.chart.lines);
  return useMemo(() => {
    if (lineId == null) return [];
    const notes = lines.find((l) => l.id === lineId)?.notes;
    if (!notes) return [];
    const out: number[] = [];
    for (const u of uids) {
      const i = notes.findIndex((n) => n.uid === u);
      if (i >= 0) out.push(i);
    }
    return out;
  }, [uids, lineId, lines]);
}

export function useSelectedEventIndices(): number[] {
  const ids = useEditorStore((s) => s.selectedEventIds);
  const lineId = useEditorStore((s) => s.selectedLineId);
  const lines = useChartStore((s) => s.chart.lines);
  return useMemo(() => {
    if (lineId == null) return [];
    const events = lines.find((l) => l.id === lineId)?.events;
    if (!events) return [];
    const out: number[] = [];
    for (const id of ids) {
      const i = events.findIndex((e) => e.id === id);
      if (i >= 0) out.push(i);
    }
    return out;
  }, [ids, lineId, lines]);
}

export function useMultiSelectedLineIndices(): number[] {
  const ids = useEditorStore((s) => s.multiSelectedLineIds);
  const lines = useChartStore((s) => s.chart.lines);
  return useMemo(() => {
    const out: number[] = [];
    for (const id of ids) {
      const i = lines.findIndex((l) => l.id === id);
      if (i >= 0) out.push(i);
    }
    return out;
  }, [ids, lines]);
}

// ---- Index -> id write helpers (caller has indices; store ids) ----

/** Select a line by its current index (null clears). */
export function selectLineByIndex(index: number | null): void {
  const es = useEditorStore.getState();
  if (index == null) {
    es.selectLine(null);
    return;
  }
  const line = useChartStore.getState().chart.lines[index];
  es.selectLine(line?.id ?? null);
}

function noteUidsAt(lineIndex: number | null, indices: number[]): string[] {
  if (lineIndex == null) return [];
  const line = useChartStore.getState().chart.lines[lineIndex];
  if (!line) return [];
  const out: string[] = [];
  for (const i of indices) {
    const u = line.notes[i]?.uid;
    if (u) out.push(u);
  }
  return out;
}

/** Replace the note selection with the given indices (within the selected line
 *  unless an explicit lineIndex is passed). */
export function setNoteSelectionByIndex(indices: number[], lineIndex?: number): void {
  const li = lineIndex ?? getSelectedLineIndex();
  useEditorStore.getState().setNoteSelection(noteUidsAt(li, indices));
}

/** Toggle a single note (by index) in/out of the selection. */
export function toggleNoteSelectionByIndex(index: number, lineIndex?: number): void {
  const li = lineIndex ?? getSelectedLineIndex();
  const uid = li == null ? undefined : useChartStore.getState().chart.lines[li]?.notes[index]?.uid;
  if (uid) useEditorStore.getState().toggleNoteSelection(uid);
}

function eventIdsAt(lineIndex: number | null, indices: number[]): string[] {
  if (lineIndex == null) return [];
  const line = useChartStore.getState().chart.lines[lineIndex];
  if (!line) return [];
  const out: string[] = [];
  for (const i of indices) {
    const id = line.events[i]?.id;
    if (id) out.push(id);
  }
  return out;
}

/** Replace the event selection with the given indices (within the selected line
 *  unless an explicit lineIndex is passed). */
export function setEventSelectionByIndex(indices: number[], lineIndex?: number): void {
  const li = lineIndex ?? getSelectedLineIndex();
  useEditorStore.getState().setEventSelection(eventIdsAt(li, indices));
}

/** Toggle a single event (by index) in/out of the selection. */
export function toggleEventSelectionByIndex(index: number, lineIndex?: number): void {
  const li = lineIndex ?? getSelectedLineIndex();
  const id = li == null ? undefined : useChartStore.getState().chart.lines[li]?.events[index]?.id;
  if (id) useEditorStore.getState().toggleEventSelection(id);
}

/** Replace the multi-line selection with the given line indices. */
export function setMultiSelectedLinesByIndex(indices: number[]): void {
  const lines = useChartStore.getState().chart.lines;
  const ids: string[] = [];
  for (const i of indices) {
    const id = lines[i]?.id;
    if (id) ids.push(id);
  }
  useEditorStore.getState().setMultiSelectedLines(ids);
}

/** Toggle a single line (by index) in/out of the multi-line selection. */
export function toggleMultiSelectedLineByIndex(index: number): void {
  const id = useChartStore.getState().chart.lines[index]?.id;
  if (id) useEditorStore.getState().toggleMultiSelectedLine(id);
}

// ---- Drag-ref id<->index helpers (hold resize, curve-track creation) ----

/** uid of the note at the given index in the given line, or null. */
export function noteUidAt(lineIndex: number, noteIndex: number): string | null {
  return useChartStore.getState().chart.lines[lineIndex]?.notes[noteIndex]?.uid ?? null;
}
