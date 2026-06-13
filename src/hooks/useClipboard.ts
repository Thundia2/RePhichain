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
import { useAudioStore } from "../stores/audioStore";
import { BpmList } from "../utils/bpmList";
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
  const es = useEditorStore.getState();
  const cs = useChartStore.getState();
  if (es.selectedLineIndex === null) return;
  const line = cs.chart.lines[es.selectedLineIndex];
  if (!line) return;

  const copiedNotes: Note[] = [];
  const copiedEvents: LineEvent[] = [];
  let baseBeat = Infinity;

  for (const idx of es.selectedNoteIndices) {
    const note = line.notes[idx];
    if (note) {
      copiedNotes.push(structuredClone(note));
      baseBeat = Math.min(baseBeat, beatToFloat(note.beat));
    }
  }
  for (const idx of es.selectedEventIndices) {
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
  if (es.selectedLineIndex === null) return;

  // Copy first
  performCopy();
  if (!clipboard) return;

  // Then delete selected
  if (es.selectedNoteIndices.length > 0) {
    cs.removeNotes(es.selectedLineIndex, es.selectedNoteIndices);
  }
  if (es.selectedEventIndices.length > 0) {
    cs.removeEvents(es.selectedLineIndex, es.selectedEventIndices);
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
  if (es.selectedLineIndex === null) return;
  const lineIndex = es.selectedLineIndex;

  const { currentTime } = useAudioStore.getState();
  const bpmList = new BpmList(cs.chart.bpm_list);
  const currentBeat = bpmList.beatAtFloat(currentTime - cs.chart.offset);
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
        start_beat: offsetBeat(event.start_beat, beatOffset),
        end_beat: offsetBeat(event.start_beat, beatOffset + duration),
      };
      cs.addEvent(lineIndex, pasted);
    }
  });

  // Reselect the pasted notes by uid against FRESH post-mutation state
  // (finding H5 — the old code read the stale pre-paste cs snapshot and matched
  // by beat, which selected nothing or also grabbed pre-existing co-beat notes).
  if (pastedUids.size > 0) {
    const line = useChartStore.getState().chart.lines[lineIndex];
    if (line) {
      const newSelection: number[] = [];
      for (let i = 0; i < line.notes.length; i++) {
        const uid = line.notes[i].uid;
        if (uid && pastedUids.has(uid)) newSelection.push(i);
      }
      es.setNoteSelection(newSelection);
    }
  }
}

export function useClipboard() {
  // ---- Copy (Ctrl+C) — delegates to extracted performCopy ----
  useHotkeys("ctrl+c, meta+c", () => performCopy(), { preventDefault: true });

  // ---- Cut (Ctrl+X) — delegates to extracted performCut ----
  useHotkeys("ctrl+x, meta+x", () => performCut(), { preventDefault: true });

  // ---- Paste (Ctrl+V) — delegates to extracted performPaste ----
  useHotkeys("ctrl+v, meta+v", () => performPaste(), { preventDefault: true });

  // ---- Cross-Line Paste (Ctrl+Shift+V) — paste to all multi-selected lines ----
  useHotkeys("ctrl+shift+v, meta+shift+v", () => {
    if (!clipboard) return;
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();

    // Determine target lines: multi-selected lines, or fall back to current line
    const targetLines = es.multiSelectedLineIndices.length > 0
      ? es.multiSelectedLineIndices
      : es.selectedLineIndex !== null ? [es.selectedLineIndex] : [];
    if (targetLines.length === 0) return;

    // Compute beat offset from the current playback position
    const { currentTime } = useAudioStore.getState();
    const bpmList = new BpmList(cs.chart.bpm_list);
    const currentBeat = bpmList.beatAtFloat(currentTime - cs.chart.offset);
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
            start_beat: offsetBeat(event.start_beat, beatOffset),
            end_beat: offsetBeat(event.start_beat, beatOffset + duration),
          };
        });

        return { lineIndex, newNotes, newEvents };
      }),
    );
  }, { preventDefault: true });
}
