// ============================================================
// Clipboard — Copy/Paste Notes and Events
//
// Stores copied notes/events in an in-memory clipboard (not the
// system clipboard, since note data isn't plain text).
//
// Paste offsets notes to the current scroll position.
//
// Recent change: Extracted performCopy/performCut/performPaste as
// standalone exported functions callable from GlobalMode buttons
// without hotkey context. Hotkey handlers now delegate to them.
// ============================================================

import { useHotkeys } from "react-hotkeys-hook";
import { useEditorStore } from "../stores/editorStore";
import { useChartStore } from "../stores/chartStore";
import { generateNoteUid } from "../utils/noteUid";
import {
  getSelectedLineIndex,
  getSelectedNoteIndices,
  getSelectedEventIndices,
  getMultiSelectedLineIndices,
} from "../stores/selection";
import { getPlayheadBeat } from "../utils/playhead";
import { useSettingsStore } from "../stores/settingsStore";
import { resolveHotkey } from "../utils/resolveHotkey";
import { beatToFloat, floatToBeat } from "../types/chart";
import type { Note, LineEvent, Beat } from "../types/chart";

interface ClipboardData {
  notes: Note[];
  events: LineEvent[];
  /** The beat of the earliest item — used to compute paste offset */
  baseBeat: number;
}

let clipboard: ClipboardData | null = null;

/** Get the current clipboard contents (for use outside the hook) */
export function getClipboard(): ClipboardData | null {
  return clipboard;
}

function offsetBeat(beat: Beat, delta: number): Beat {
  return floatToBeat(Math.max(0, beatToFloat(beat) + delta));
}

/**
 * Standalone copy — can be called from buttons without hotkey context.
 * Copies selected notes/events from the current line into the in-memory clipboard.
 */
export function performCopy(): void {
  const cs = useChartStore.getState();
  const lineIndex = getSelectedLineIndex();
  if (lineIndex === null) return;
  const line = cs.chart.lines[lineIndex];
  if (!line) return;

  const copiedNotes: Note[] = [];
  const copiedEvents: LineEvent[] = [];
  let baseBeat = Infinity;

  for (const idx of getSelectedNoteIndices()) {
    const note = line.notes[idx];
    if (note) {
      copiedNotes.push(structuredClone(note));
      baseBeat = Math.min(baseBeat, beatToFloat(note.beat));
    }
  }
  for (const idx of getSelectedEventIndices()) {
    const event = line.events[idx];
    if (event) {
      copiedEvents.push(structuredClone(event));
      baseBeat = Math.min(baseBeat, beatToFloat(event.start_beat));
    }
  }

  if (copiedNotes.length === 0 && copiedEvents.length === 0) return;
  clipboard = { notes: copiedNotes, events: copiedEvents, baseBeat: baseBeat === Infinity ? 0 : baseBeat };
}

/**
 * Standalone cut — copies then deletes selected notes/events.
 */
export function performCut(): void {
  const es = useEditorStore.getState();
  const cs = useChartStore.getState();
  const lineIndex = getSelectedLineIndex();
  if (lineIndex === null) return;

  // Copy first
  performCopy();
  if (!clipboard) return;

  // Then delete selected (note + event selection are mutually exclusive)
  const noteIndices = getSelectedNoteIndices();
  const eventIndices = getSelectedEventIndices();
  if (noteIndices.length > 0) {
    cs.removeNotes(lineIndex, noteIndices);
  }
  if (eventIndices.length > 0) {
    cs.removeEvents(lineIndex, eventIndices);
  }
  es.clearSelection();
}

/**
 * Standalone paste — pastes clipboard contents at the current playhead position.
 */
export function performPaste(): void {
  if (!clipboard) return;
  const es = useEditorStore.getState();
  const cs = useChartStore.getState();
  const lineIndex = getSelectedLineIndex();
  if (lineIndex === null) return;

  const currentBeat = getPlayheadBeat();
  const beatOffset = currentBeat - clipboard.baseBeat;

  // Assign fresh uids up front so pasted notes don't collide with their source
  // notes (finding A2 — structuredClone previously carried the original uid,
  // producing duplicate uids that break group refs and identity reselection),
  // and so we can reselect them by identity after the adds re-sort the array.
  const pastedNotes: Note[] = clipboard.notes.map((note) => ({
    ...structuredClone(note),
    uid: generateNoteUid(),
    beat: offsetBeat(note.beat, beatOffset),
  }));
  const pastedUids = new Set(pastedNotes.map((n) => n.uid!));

  // One undo entry for the whole paste (L1 transaction) instead of one per note.
  cs.transaction(() => {
    for (const pasted of pastedNotes) {
      cs.addNote(lineIndex, pasted);
    }
    for (const event of clipboard!.events) {
      const duration = beatToFloat(event.end_beat) - beatToFloat(event.start_beat);
      const pasted: LineEvent = {
        ...structuredClone(event),
        id: undefined, // fresh id (finding L2) — structuredClone carried the source id
        start_beat: offsetBeat(event.start_beat, beatOffset),
        end_beat: offsetBeat(event.start_beat, beatOffset + duration),
      };
      // Route flat<->layer (finding L3) so a paste onto a layered line is visible.
      cs.addEventRouted(lineIndex, pasted);
    }
  });

  // Reselect the pasted notes directly by uid (selection is identity-based —
  // findings L2/H5; no index resolution or stale-snapshot beat matching needed).
  if (pastedUids.size > 0) {
    es.setNoteSelection([...pastedUids]);
  }
}

export function useClipboard() {
  // Subscribe to overrides so cross_line_paste rebinds live (L7). copy/cut/paste stay
  // hardcoded — they're not in the registry (conventional clipboard combos).
  const overrides = useSettingsStore((s) => s.hotkeyOverrides);

  // ---- Copy (Ctrl+C) — delegates to extracted performCopy ----
  useHotkeys("ctrl+c, meta+c", () => performCopy(), { preventDefault: true });

  // ---- Cut (Ctrl+X) — delegates to extracted performCut ----
  useHotkeys("ctrl+x, meta+x", () => performCut(), { preventDefault: true });

  // ---- Paste (Ctrl+V) — delegates to extracted performPaste ----
  useHotkeys("ctrl+v, meta+v", () => performPaste(), { preventDefault: true });

  // ---- Cross-Line Paste (registry cross_line_paste, default Ctrl+Shift+V) ----
  useHotkeys(resolveHotkey(overrides, "cross_line_paste"), () => {
    if (!clipboard) return;
    const cs = useChartStore.getState();

    // Determine target lines: multi-selected lines, or fall back to current line
    const multiLineIndices = getMultiSelectedLineIndices();
    const selectedLineIndex = getSelectedLineIndex();
    const targetLines = multiLineIndices.length > 0
      ? multiLineIndices
      : selectedLineIndex !== null ? [selectedLineIndex] : [];
    if (targetLines.length === 0) return;

    // Compute beat offset from the current playback position
    const currentBeat = getPlayheadBeat();
    const beatOffset = currentBeat - clipboard.baseBeat;

    // Build mutations for all target lines — single undo entry via batchMultiLineMutations
    cs.batchMultiLineMutations(
      targetLines.map((lineIndex) => {
        const newNotes = clipboard!.notes.map((note) => ({
          ...structuredClone(note),
          uid: undefined, // Force new UID generation for each copy
          beat: offsetBeat(note.beat, beatOffset),
        }));

        const newEvents = clipboard!.events.map((event) => {
          const duration = beatToFloat(event.end_beat) - beatToFloat(event.start_beat);
          return {
            ...structuredClone(event),
            id: undefined, // fresh id (finding L2) — avoid duplicate event ids across copies
            start_beat: offsetBeat(event.start_beat, beatOffset),
            end_beat: offsetBeat(event.start_beat, beatOffset + duration),
          };
        });

        return { lineIndex, newNotes, newEvents };
      }),
    );
  }, { preventDefault: true });
}
