// ============================================================
// Global Hotkey System
//
// Registers all keyboard shortcuts using react-hotkeys-hook.
// Call useGlobalHotkeys() once in App.tsx to activate them.
//
// Recent change: Added F2 hotkey for inline tab rename.
// ============================================================

import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useEditorStore } from "../stores/editorStore";
import { useChartStore } from "../stores/chartStore";
import {
  getSelectedLineIndex,
  getSelectedNoteIndices,
  getSelectedEventIndices,
  getMultiSelectedLineIndices,
  setNoteSelectionByIndex,
  selectLineByIndex,
} from "../stores/selection";
import { useAudioStore } from "../stores/audioStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useGroupStore } from "../stores/groupStore";
import { useBookmarkStore } from "../stores/bookmarkStore";
import { useTabStore } from "../stores/tabStore";
import { audioEngine } from "../audio/audioEngine";
import { CANVAS_WIDTH } from "../types/chart";
import type { BookmarkPreset } from "../types/bookmark";
import { addBeats, subtractBeats, minimumBeat, snapBeat, beatToFloat, floatToBeat } from "../utils/beat";
import { getPlayheadBeat } from "../utils/playhead";
import { resolveHotkey } from "../utils/resolveHotkey";
import { splitSelectedEventsAtPlayhead } from "../utils/eventSplit";
import { addMarkerAtCurrentBeat, seekToPrevBookmark, seekToNextBookmark } from "../utils/bookmarkNavigation";
import type { EditorTool } from "../types/editor";
import { useToastStore } from "../stores/toastStore";
import { useContextPanelStore } from "../stores/contextPanelStore";

export function useGlobalHotkeys(callbacks: {
  onNewChart?: () => void;
  onCommandPalette?: () => void;
  onImportChart?: () => void;
  onShowGoToBeat?: () => void;
  onShowPasteSpecial?: () => void;
  onShowOnsetCalibration?: () => void;
}) {
  // ---- Hotkey resolution (L7) ----
  // Subscribe to overrides so a rebind in HotkeySettings re-renders this hook and
  // react-hotkeys-hook swaps the listener to the new key. hk(id) = override ?? registry
  // default. Every registry-backed binding below passes hk("action_id") as its key, so
  // the settings panel + conflict checker + persisted overrides are finally live.
  // grep resolveHotkey. Modal/secondary combos (CapsLock event tools, panel toggles,
  // improv number keys, escape) stay hardcoded — intentionally not rebindable.
  const overrides = useSettingsStore((s) => s.hotkeyOverrides);
  const hk = (id: string) => resolveHotkey(overrides, id);

  // ---- Tool shortcuts ----
  const setTool = (tool: EditorTool) => () => useEditorStore.getState().setTool(tool);

  useHotkeys(hk("select_tool"), setTool("select"), { preventDefault: true });
  useHotkeys(hk("eraser_tool"), setTool("eraser"), { preventDefault: true });

  // Q/W/E/R: CapsLock = event tool; else mark / step record / note tool.
  // CapsLock takes priority — see plan tingly-napping-crayon.md §4.
  // event.getModifierState("CapsLock") reads the OS state and works
  // in Tauri's webview the same as in the browser.
  useHotkeys(hk("place_tap"), (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_x"); return; }
    if (es.improvisationMode) { improvPlace("tap"); return; }
    if (es.stepRecordActive) { es.setStepRecordNoteKind("tap"); return; }
    es.setTool("place_tap");
  }, { preventDefault: true });
  useHotkeys(hk("place_drag"), (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_y"); return; }
    if (es.improvisationMode) { improvPlace("drag"); return; }
    if (es.stepRecordActive) { es.setStepRecordNoteKind("drag"); return; }
    es.setTool("place_drag");
  }, { preventDefault: true });
  useHotkeys(hk("place_flick"), (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_rotation"); return; }
    if (es.improvisationMode) { improvPlace("flick"); return; }
    if (es.stepRecordActive) { es.setStepRecordNoteKind("flick"); return; }
    es.setTool("place_flick");
  }, { preventDefault: true });
  useHotkeys(hk("place_hold"), (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_opacity"); return; }
    if (es.improvisationMode) { improvPlace("hold"); return; }
    if (es.stepRecordActive) { es.setStepRecordNoteKind("hold"); return; }
    es.setTool("place_hold");
  }, { preventDefault: true });

  // ---- Unified Editor panels ----
  useHotkeys("l", () => useEditorStore.getState().toggleLineDrawer(), { preventDefault: true });
  // I: CapsLock = Color event tool; else toggle Unified Inspector
  useHotkeys("i", (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_color"); return; }
    es.toggleUnifiedInspector();
  }, { preventDefault: true });
  useHotkeys("k", () => useEditorStore.getState().toggleKeyframeBar(), { preventDefault: true });
  useHotkeys("shift+k", () => useEditorStore.getState().toggleCurveEditorExpanded(), { preventDefault: true });
  useHotkeys("ctrl+shift+k, meta+shift+k", () => {
    const es = useEditorStore.getState();
    if (es.curveEditorExpanded) {
      es.setCurveEditorPoppedOut(!es.curveEditorPoppedOut);
    }
  }, { preventDefault: true });

  // ---- Quick panel hotkeys ----
  useHotkeys("alt+1", () => useEditorStore.getState().toggleCanvasPanel("timeline"), { preventDefault: true });
  useHotkeys("alt+2", () => useEditorStore.getState().toggleCanvasPanel("line-list"), { preventDefault: true });
  useHotkeys("alt+3", () => useEditorStore.getState().toggleCanvasPanel("effects"), { preventDefault: true });

  // ---- LineStrip search ----
  useHotkeys("ctrl+l, meta+l", () => useEditorStore.getState().toggleLineStripSearch(), { preventDefault: true });

  // ---- Record mode ----
  useHotkeys("alt+r", () => useEditorStore.getState().toggleRecordMode(), { preventDefault: true });

  // ---- Onset Detection toggle ----
  useHotkeys(hk("toggle_onset_detection"), () => {
    const ss = useSettingsStore.getState();
    ss.updateSettings({ onsetDetectionEnabled: !ss.onsetDetectionEnabled });
  }, { preventDefault: true });

  // ---- Undo / Redo ----
  // Interleaved: compare sequence numbers to decide which store (chart vs bookmark) to undo/redo
  useHotkeys(hk("undo"), () => {
    const cs = useChartStore.getState();
    const bs = useBookmarkStore.getState();
    const es = useEditorStore.getState();

    // Determine which store had the most recent action by comparing top-of-stack sequence numbers
    const chartTopSeq = cs._pastSeqs.length > 0 ? cs._pastSeqs[cs._pastSeqs.length - 1] : 0;
    const bmTopSeq = bs._pastSeqs.length > 0 ? bs._pastSeqs[bs._pastSeqs.length - 1] : 0;

    if (bmTopSeq > chartTopSeq && bs.canUndo()) {
      bs.undo();
    } else {
      cs.undo();
      // If in step record mode, also rewind the beat counter
      if (es.stepRecordActive && es.stepRecordNotesPlaced > 0) {
        es.rewindStepBeat();
      }
    }
  }, { preventDefault: true });
  // Redo — Ctrl+Y added as alias alongside Ctrl+Shift+Z
  useHotkeys(hk("redo"), () => {
    const cs = useChartStore.getState();
    const bs = useBookmarkStore.getState();

    const chartRedoSeq = cs._futureSeqs.length > 0 ? cs._futureSeqs[cs._futureSeqs.length - 1] : 0;
    const bmRedoSeq = bs._futureSeqs.length > 0 ? bs._futureSeqs[bs._futureSeqs.length - 1] : 0;

    if (bmRedoSeq > chartRedoSeq && bs.canRedo()) {
      bs.redo();
    } else {
      cs.redo();
    }
  }, { preventDefault: true });

  // ---- Delete selected ----
  useHotkeys(hk("delete"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const bs = useBookmarkStore.getState();

    // Check for selected bookmarks first — they take priority so we don't
    // accidentally delete a line when the user just wanted to remove markers
    if (bs.selectedBookmarkIds.length > 0) {
      bs.deleteSelected();
      return;
    }

    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;
    const noteIndices = getSelectedNoteIndices();
    const eventIndices = getSelectedEventIndices();
    const multiLineIndices = getMultiSelectedLineIndices();

    if (noteIndices.length > 0) {
      cs.removeNotes(lineIndex, noteIndices);
      es.clearSelection();
    } else if (eventIndices.length > 0) {
      cs.removeEvents(lineIndex, eventIndices);
      es.clearSelection();
    } else if (multiLineIndices.length > 0) {
      // Delete multi-selected lines (in reverse order to preserve indices)
      const sorted = [...multiLineIndices].sort((a, b) => b - a);
      for (const idx of sorted) {
        cs.removeLine(idx);
      }
      es.clearMultiSelectedLines();
      es.selectLine(null);
    } else if (cs.chart.lines.length > 0) {
      // Delete the currently selected line
      cs.removeLine(lineIndex);
      // Select an adjacent line, or deselect if none left
      const remaining = cs.chart.lines.length; // already removed
      if (remaining === 0) {
        es.selectLine(null);
      } else {
        selectLineByIndex(Math.min(lineIndex, remaining - 1));
      }
    }
  }, { preventDefault: true });

  // ---- AI tab hotkey (Ctrl+Shift+A) — switch to AI tab in context panel ----
  // Must be registered BEFORE ctrl+a so the modifier check takes priority
  useHotkeys("ctrl+shift+a, meta+shift+a", () => {
    if (!useSettingsStore.getState().aiEnabled) return;
    const multiLen = getMultiSelectedLineIndices().length;
    let mode: string;
    if (multiLen > 1) mode = "multi";
    else if (getSelectedEventIndices().length > 0) mode = "event";
    else if (getSelectedNoteIndices().length > 0) mode = "note";
    else if (getSelectedLineIndex() !== null) mode = "line";
    else mode = "global";
    useContextPanelStore.getState().setActiveTab(mode, "ai");
    useContextPanelStore.getState().setCollapsed(false);
  }, { preventDefault: true });

  // ---- Select all notes on current line ----
  useHotkeys(hk("select_all"), () => {
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;
    setNoteSelectionByIndex(line.notes.map((_, i) => i));
  }, { preventDefault: true });

  // ---- Move selected notes/events with arrow keys ----

  // ArrowUp: Move selected notes/events forward in time by one grid step
  useHotkeys(hk("move_up"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;
    const step = minimumBeat(es.density);
    const noteIndices = getSelectedNoteIndices();
    const eventIndices = getSelectedEventIndices();

    if (noteIndices.length > 0) {
      const line = cs.chart.lines[lineIndex];
      if (!line) return;
      cs.batchEditNotes(lineIndex,
        noteIndices.map((idx) => ({
          noteIndex: idx,
          changes: { beat: addBeats(line.notes[idx].beat, step) },
        })),
      );
    } else if (eventIndices.length > 0) {
      const line = cs.chart.lines[lineIndex];
      if (!line) return;
      cs.batchEditEvents(lineIndex,
        eventIndices.map((idx) => ({
          eventIndex: idx,
          changes: {
            start_beat: addBeats(line.events[idx].start_beat, step),
            end_beat: addBeats(line.events[idx].end_beat, step),
          },
        })),
      );
    }
  }, { preventDefault: true });

  // ArrowDown: Move selected notes/events backward in time
  useHotkeys(hk("move_down"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;
    const step = minimumBeat(es.density);
    const noteIndices = getSelectedNoteIndices();
    const eventIndices = getSelectedEventIndices();

    if (noteIndices.length > 0) {
      const line = cs.chart.lines[lineIndex];
      if (!line) return;
      cs.batchEditNotes(lineIndex,
        noteIndices.map((idx) => ({
          noteIndex: idx,
          changes: { beat: subtractBeats(line.notes[idx].beat, step) },
        })),
      );
    } else if (eventIndices.length > 0) {
      const line = cs.chart.lines[lineIndex];
      if (!line) return;
      cs.batchEditEvents(lineIndex,
        eventIndices.map((idx) => ({
          eventIndex: idx,
          changes: {
            start_beat: subtractBeats(line.events[idx].start_beat, step),
            end_beat: subtractBeats(line.events[idx].end_beat, step),
          },
        })),
      );
    }
  }, { preventDefault: true });

  // ArrowRight: Move selected notes right in X position
  useHotkeys(hk("move_right"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length === 0) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    const xStep = es.verticalLines >= 2 ? Math.round(CANVAS_WIDTH / (es.verticalLines - 1)) : 0;
    if (xStep === 0) return;
    cs.batchEditNotes(lineIndex,
      noteIndices.map((idx) => ({
        noteIndex: idx,
        changes: { x: line.notes[idx].x + xStep },
      })),
    );
  }, { preventDefault: true });

  // ArrowLeft: Move selected notes left in X position
  useHotkeys(hk("move_left"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length === 0) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    const xStep = es.verticalLines >= 2 ? Math.round(CANVAS_WIDTH / (es.verticalLines - 1)) : 0;
    if (xStep === 0) return;
    cs.batchEditNotes(lineIndex,
      noteIndices.map((idx) => ({
        noteIndex: idx,
        changes: { x: line.notes[idx].x - xStep },
      })),
    );
  }, { preventDefault: true });

  // ---- Playback ----
  useHotkeys(hk("toggle_playback"), () => {
    audioEngine.togglePlayPause();
  }, { preventDefault: true });

  // ---- Loop region markers ----
  // [ — set loop start at current playhead beat
  // useKey:true — punctuation matches via event.key; without it react-hotkeys-hook
  // compares event.code ("BracketLeft") and "[" never fires (the old dead binding).
  useHotkeys(hk("loop_start"), () => {
    const as_ = useAudioStore.getState();
    const cs = useChartStore.getState();
    if (!cs.isLoaded) return;
    const currentBeat = getPlayheadBeat({ clampNonNegative: true });
    as_.setLoopStart(currentBeat);
  }, { preventDefault: true, useKey: true });

  // ] — set loop end at current playhead beat
  useHotkeys(hk("loop_end"), () => {
    const as_ = useAudioStore.getState();
    const cs = useChartStore.getState();
    if (!cs.isLoaded) return;
    const currentBeat = getPlayheadBeat({ clampNonNegative: true });
    as_.setLoopEnd(currentBeat);
  }, { preventDefault: true, useKey: true });

  // \ — toggle loop on/off (useKey:true, same punctuation reason as the loop brackets)
  useHotkeys(hk("toggle_loop"), () => {
    useAudioStore.getState().toggleLoop();
  }, { preventDefault: true, useKey: true });

  // ---- Save ----
  useHotkeys(hk("save"), async () => {
    const cs = useChartStore.getState();
    if (!cs.isLoaded) return;
    try {
      if (cs.projectPath) {
        const { saveProject } = await import("../utils/ipc");
        await saveProject(cs.projectPath, cs.getChartJson());
      }
      cs.markClean();
      useToastStore.getState().addToast({ message: "Project saved", type: "success", duration: 1500 });
    } catch (e) {
      console.error("Save failed:", e);
      useToastStore.getState().addToast({ message: "Save failed", type: "error" });
    }
  }, { preventDefault: true });

  // ---- New chart ----
  useHotkeys(hk("new_chart"), () => {
    callbacks.onNewChart?.();
  }, { preventDefault: true });

  // ---- Command palette ----
  useHotkeys("ctrl+k, meta+k", () => {
    callbacks.onCommandPalette?.();
  }, { preventDefault: true });

  // ---- Rename active tab ----
  useHotkeys("f2", () => {
    useTabStore.getState().startRenameTab();
  }, { preventDefault: true });

  // ---- Import chart ----
  useHotkeys("ctrl+o, meta+o", () => {
    callbacks.onImportChart?.();
  }, { preventDefault: true });

  // ---- Go to Beat dialog ----
  // L7 drift fix: registry default is now ctrl+g (was bound to ctrl+j in code; the
  // pattern tool vacated ctrl+g → moved to "p"). grep go_to_beat / pattern_tool.
  useHotkeys(hk("go_to_beat"), () => {
    callbacks.onShowGoToBeat?.();
  }, { preventDefault: true });

  // ---- Onset Calibration dialog (Phase C of onset plan, 2026-04-20) ----
  useHotkeys("ctrl+shift+o, meta+shift+o", () => {
    callbacks.onShowOnsetCalibration?.();
  }, { preventDefault: true });

  // ---- Paste Special dialog ----
  useHotkeys(hk("paste_special"), () => {
    callbacks.onShowPasteSpecial?.();
  }, { preventDefault: true });

  // ---- Flip selected notes above/below ----
  useHotkeys(hk("flip_notes"), () => {
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length === 0) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    cs.batchEditNotes(lineIndex,
      noteIndices.map((idx) => ({
        noteIndex: idx,
        changes: { above: !line.notes[idx].above },
      })),
    );
  }, { preventDefault: true });

  // ---- Mirror selected notes horizontally (negate X) ----
  useHotkeys(hk("mirror_notes"), () => {
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length === 0) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    cs.batchEditNotes(lineIndex,
      noteIndices.map((idx) => ({
        noteIndex: idx,
        changes: { x: -line.notes[idx].x },
      })),
    );
  }, { preventDefault: true });

  // ---- Quantize selected notes to beat grid ----
  useHotkeys(hk("quantize_notes"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length === 0) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    cs.batchEditNotes(lineIndex,
      noteIndices.map((idx) => ({
        noteIndex: idx,
        changes: { beat: snapBeat(beatToFloat(line.notes[idx].beat), es.density) },
      })),
    );
  }, { preventDefault: true });

  // ---- Distribute selected notes evenly in time ----
  useHotkeys(hk("distribute_notes"), () => {
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length < 3) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    // Sort selected notes by beat to find the range
    const sorted = [...noteIndices]
      .map((idx) => ({ idx, beat: beatToFloat(line.notes[idx].beat) }))
      .sort((a, b) => a.beat - b.beat);

    const firstBeat = sorted[0].beat;
    const lastBeat = sorted[sorted.length - 1].beat;
    if (lastBeat <= firstBeat) return; // All at same beat — nothing to distribute
    const step = (lastBeat - firstBeat) / (sorted.length - 1);

    cs.batchEditNotes(lineIndex,
      sorted.map((entry, i) => ({
        noteIndex: entry.idx,
        changes: { beat: floatToBeat(firstBeat + i * step) },
      })),
    );
  }, { preventDefault: true });

  // ---- Strum/stagger selected notes (spread beats by X position order) ----
  useHotkeys(hk("strum_notes"), () => {
    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    if (lineIndex === null || noteIndices.length < 2) return;
    const line = cs.chart.lines[lineIndex];
    if (!line) return;

    // Sort selected notes by X position (left to right)
    const sorted = [...noteIndices]
      .map((idx) => ({ idx, x: line.notes[idx].x, beat: beatToFloat(line.notes[idx].beat) }))
      .sort((a, b) => a.x - b.x);

    // Apply incremental beat offset: each note gets +i * (1/density) beats
    const strumStep = 1 / es.density;
    cs.batchEditNotes(lineIndex,
      sorted.map((entry, i) => ({
        noteIndex: entry.idx,
        changes: { beat: floatToBeat(entry.beat + i * strumStep) },
      })),
    );
  }, { preventDefault: true });

  // ---- Fit All (Shift+F) — zoom to fit all visible lines ----
  useHotkeys("shift+f", () => {
    useEditorStore.getState().resetCanvasViewport();
  }, { preventDefault: true });

  // ---- Beat Sync placement toggle ----
  // T: CapsLock = Speed event tool; else toggle Beat Sync placement.
  useHotkeys("t", (event) => {
    const es = useEditorStore.getState();
    if (event.getModifierState("CapsLock")) { es.setTool("place_event_speed"); return; }
    es.toggleBeatSyncPlacement();
  }, { preventDefault: true, enableOnFormTags: false });

  // ---- Y / U / O — CapsLock-only event hotkeys ----
  // These keys aren't bound otherwise, but per the user's spec they
  // STILL require CapsLock so the event-mode dimension remains
  // consistent across the QWERTY top row. No-op without CapsLock.
  useHotkeys("y", (event) => {
    if (!event.getModifierState("CapsLock")) return;
    useEditorStore.getState().setTool("place_event_scale_x");
  }, { preventDefault: true });
  useHotkeys("u", (event) => {
    if (!event.getModifierState("CapsLock")) return;
    useEditorStore.getState().setTool("place_event_scale_y");
  }, { preventDefault: true });
  useHotkeys("o", (event) => {
    if (!event.getModifierState("CapsLock")) return;
    useEditorStore.getState().setTool("place_event_text");
  }, { preventDefault: true });

  // ---- Step Record toggle (L7: moved off "s" → registry step_record default "b";
  //      "s" now belongs to split_event, registered below) ----
  useHotkeys(hk("step_record"), () => {
    useEditorStore.getState().toggleStepRecord();
  }, { preventDefault: true, enableOnFormTags: false });

  // ---- Split Event at playhead (L7: registry split_event, default "s") ----
  // Shares splitSelectedEventsAtPlayhead with the Edit-menu item (useMenus.ts).
  useHotkeys(hk("split_event"), () => {
    splitSelectedEventsAtPlayhead();
  }, { preventDefault: true, enableOnFormTags: false });

  // ---- X Snap toggle ----
  useHotkeys("shift+x", () => {
    useEditorStore.getState().toggleXSnap();
  }, { preventDefault: true });

  // ---- Step size adjustment (only during step recording) ----
  useHotkeys("shift+up", () => {
    const es = useEditorStore.getState();
    if (es.stepRecordActive) es.doubleStepSize();
  }, { preventDefault: true });

  useHotkeys("shift+down", () => {
    const es = useEditorStore.getState();
    if (es.stepRecordActive) es.halveStepSize();
  }, { preventDefault: true });

  // ---- Group editing ----

  // Toggle pattern tool (L7: moved off ctrl+g → registry pattern_tool default "p";
  // ctrl+g now opens Go to Beat).
  useHotkeys(hk("pattern_tool"), () => {
    const es = useEditorStore.getState();
    es.setTool(es.activeTool === "place_pattern" ? "select" : "place_pattern");
  }, { preventDefault: true });

  // Ctrl+Shift+G: Create group from currently selected lines or notes
  useHotkeys("ctrl+shift+g, meta+shift+g", () => {
    const cs = useChartStore.getState();
    const gs = useGroupStore.getState();
    const lineIndex = getSelectedLineIndex();
    const noteIndices = getSelectedNoteIndices();
    const multiLineIndices = getMultiSelectedLineIndices();

    // Collect selected notes (from current line)
    const notesToAdd: Array<{ uid: string; lineIndex: number }> = [];
    if (lineIndex !== null && noteIndices.length > 0) {
      const line = cs.chart.lines[lineIndex];
      if (line) {
        for (const ni of noteIndices) {
          const note = line.notes[ni];
          if (note?.uid) {
            notesToAdd.push({ uid: note.uid, lineIndex });
          }
        }
      }
    }

    // If notes are selected, create a Note Group
    if (notesToAdd.length > 0) {
      const groupId = gs.createNoteGroup(
        `Note Group ${gs.groups.length + 1}`,
        [0, 0, 1],
        [999, 0, 1],
      );
      for (const { uid, lineIndex } of notesToAdd) {
        gs.addNoteToGroup(groupId, uid, lineIndex);
      }
      gs.enterGroupEditMode(groupId);
      useEditorStore.getState().setCanvasActivePanel("group-manager");
      return;
    }

    // Otherwise, create a Line Group from selected lines
    const linesToAdd = multiLineIndices.length > 0
      ? multiLineIndices
      : lineIndex !== null ? [lineIndex] : [];

    if (linesToAdd.length === 0) return;

    const groupId = gs.createLineGroup(
      `Line Group ${gs.groups.length + 1}`,
      [0, 0, 1],
      [999, 0, 1],
    );
    for (const li of linesToAdd) {
      gs.addLineToGroup(groupId, li);
    }
    gs.enterGroupEditMode(groupId);
    useEditorStore.getState().setCanvasActivePanel("group-manager");
  }, { preventDefault: true });

  // Escape: Exit step record first, then group edit mode, then clear loop
  useHotkeys("escape", () => {
    const es = useEditorStore.getState();
    if (es.stepRecordActive) { es.exitStepRecord(); return; }
    const gs = useGroupStore.getState();
    if (gs.activeGroupId) { gs.exitGroupEditMode(); return; }
    // Clear loop region markers if set
    const as_ = useAudioStore.getState();
    if (as_.loopStartBeat !== null || as_.loopEndBeat !== null) {
      as_.clearLoop();
    }
  }, { preventDefault: false });

  // G: Context-aware — toggle mini preview in unrolled editor, else enter group edit mode
  useHotkeys(hk("enter_group_edit"), () => {
    // Check which tab type is active to decide behavior
    const activeTab = useTabStore.getState().tabs.find(
      (t) => t.id === useTabStore.getState().activeTabId
    );

    // In unrolled editor: toggle mini game preview
    if (activeTab?.type === "unrolled_editor") {
      useEditorStore.getState().toggleMiniPreview();
      return;
    }

    // Elsewhere: existing group edit mode behavior
    const gs = useGroupStore.getState();

    // If already in group mode, ignore
    if (gs.activeGroupId) return;

    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;
    const lineGroups = gs.getGroupsForLine(lineIndex);
    if (lineGroups.length > 0) {
      gs.enterGroupEditMode(lineGroups[0].id);
    }
  }, { preventDefault: true, enableOnFormTags: false });

  // Ctrl+Shift+U: Open/focus the unrolled editor tab
  useHotkeys(hk("open_unrolled"), () => {
    useTabStore.getState().openUnrolledEditor();
  }, { preventDefault: true });

  // ---- Mark mode toggle ----
  useHotkeys("shift+i", () => {
    useEditorStore.getState().toggleImprovisationMode();
  }, { preventDefault: true });

  // ---- Mark mode: place colored bookmarks during playback ----
  const improvPlace = (preset: BookmarkPreset) => {
    const es = useEditorStore.getState();
    const as_ = useAudioStore.getState();

    if (!es.improvisationMode || !as_.isPlaying) return;
    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;

    const bs = useBookmarkStore.getState();

    // INPUT-latency compensation: shift the TIME back (bookmarkStore.latencyOffset)
    // so the marker lands where the sound was, not where the playhead is when your
    // finger hits the key. This is distinct from render latency (audioLatencyMs) —
    // we apply it via the helper's `time` override; the offset+bpm policy is shared.
    const compensatedTime = as_.currentTime + (bs.latencyOffset / 1000);
    const currentBeat = getPlayheadBeat({ time: compensatedTime });
    const beat = snapBeat(currentBeat, es.density);

    bs.addBookmark(beat, 0, true, lineIndex, preset);
  };

  // Misc markers (1-3) — only fire in mark mode
  useHotkeys("1", () => {
    if (useEditorStore.getState().improvisationMode) improvPlace("orange");
  }, { preventDefault: false, enableOnFormTags: false });
  useHotkeys("2", () => {
    if (useEditorStore.getState().improvisationMode) improvPlace("green");
  }, { preventDefault: false, enableOnFormTags: false });
  useHotkeys("3", () => {
    if (useEditorStore.getState().improvisationMode) improvPlace("violet");
  }, { preventDefault: false, enableOnFormTags: false });

  // ---- Section marker hotkey (Ctrl+B) — add marker at current beat ----
  useHotkeys(hk("add_section_marker"), () => {
    addMarkerAtCurrentBeat();
  }, { preventDefault: true });

  // ---- Bookmark marker navigation (L7: registry prev/next_marker, ctrl+up/down).
  // These ops already existed (Ctrl+Shift+Scroll wheel below); now keyboard-bound too. ----
  useHotkeys(hk("prev_marker"), () => {
    if (!useChartStore.getState().isLoaded) return;
    seekToPrevBookmark();
  }, { preventDefault: true });
  useHotkeys(hk("next_marker"), () => {
    if (!useChartStore.getState().isLoaded) return;
    seekToNextBookmark();
  }, { preventDefault: true });

  // ---- Toggle in-app DevTools panel (L7: registry toggle_devtools, "f12").
  // Note: native webview devtools may swallow F12 in `tauri dev`; works in prod. ----
  useHotkeys(hk("toggle_devtools"), () => {
    useEditorStore.getState().toggleDevTools();
  }, { preventDefault: true });

  // ---- Ctrl+Shift+Scroll for bookmark navigation ----
  // Uses Ctrl+Shift+wheel to avoid conflicting with Ctrl+wheel (canvas zoom)
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Require BOTH Ctrl and Shift to avoid conflict with canvas Ctrl+scroll zoom
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (!useChartStore.getState().isLoaded) return;

      // Only navigate if there are bookmarks to navigate to
      const bookmarks = useBookmarkStore.getState().bookmarks;
      if (!bookmarks || bookmarks.length === 0) return;

      if (e.deltaY < 0) {
        seekToNextBookmark();
      } else if (e.deltaY > 0) {
        seekToPrevBookmark();
      }
      e.preventDefault();
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);
}
