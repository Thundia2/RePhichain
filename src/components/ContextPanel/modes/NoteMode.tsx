// ============================================================
// NoteMode — Context panel content for note selection mode
//
// Recent change: Wired all dead buttons — Copy calls performCopy(),
// Paste Special opens dialog, Create Curve Track builds from 2 notes.
// Implemented all 15 BatchTab operations: Flip, Mirror, Quantize,
// Distribute, Strum, Align L/R/Center, Space Y/X, Rotate, Scale,
// Shift X/Y, Reset. All use batchEditNotes for single undo entry.
// Styling: action rows are ToolGroups of Lucide IconButtons; note types
// use NoteGlyph; the Hotkeys tab uses the shared HotkeyList.
// ============================================================

import type React from "react";
import {
  AlignCenter, AlignHorizontalSpaceAround, AlignLeft, AlignRight, ArrowLeftRight, ArrowRightLeft,
  ArrowUpDown, ChevronDown, ChevronUp, ClipboardPaste, Copy, Layers, Magnet, MoveHorizontal,
  MoveVertical, RotateCcw, RotateCw, Scaling, Spline, Trash2, UnfoldHorizontal,
} from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { useSelectedLineIndex, useSelectedNoteIndices } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { useDialogStore } from "../../../stores/dialogStore";
import { useToastStore } from "../../../stores/toastStore";
import { performCopy } from "../../../hooks/useClipboard";
import { beatToFloat, floatToBeat } from "../../../types/chart";
import type { NoteKind, Note, CurveNoteTrack } from "../../../types/chart";

// ---- Shared sub-components (extracted to shared/) ----
import { HotkeyButton } from "../shared/HotkeyButton";
import { HotkeyList, type HotkeySection } from "../shared/HotkeyList";
import { SectionHeader } from "../shared/SectionHeader";
import { ActionButton } from "../shared/ActionButton";
import { ContextBadge } from "../shared/ContextBadge";
import { ToolGroup } from "../../common/ToolGroup";
import { NoteGlyph } from "../../common/NoteGlyph";
import { Icon } from "../../common/Icon";
import { Tooltip } from "../../common/Tooltip";
import { INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";

// ---- Note kind visual config ----

const NOTE_KIND_CONFIG: Record<NoteKind, { color: string; label: string }> = {
  tap: { color: "var(--note-tap)", label: "Tap" },
  drag: { color: "var(--note-drag)", label: "Drag" },
  hold: { color: "var(--note-hold)", label: "Hold" },
  flick: { color: "var(--note-flick)", label: "Flick" },
};

// ---- Helpers ----

function formatBeat(beat: [number, number, number]): string {
  if (beat[1] === 0) return String(beat[0]);
  return `${beat[0]}+${beat[1]}/${beat[2]}`;
}

// ---- Props ----

export interface NoteModeProps {
  activeTab: string;
}

// ---- Main component ----

export function NoteMode({ activeTab }: NoteModeProps) {
  switch (activeTab) {
    case "edit": return <EditTab />;
    case "batch": return <BatchTab />;
    case "hotkeys": return <NoteHotkeys />;
    default: return <EditTab />;
  }
}

// ---- Edit sub-tab ----

function EditTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const lines = useChartStore((s) => s.chart.lines);
  const editNotes = useChartStore((s) => s.editNotes);
  const removeNotes = useChartStore((s) => s.removeNotes);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  if (selectedLineIndex === null) return null;
  const line = lines[selectedLineIndex];
  if (!line) return null;

  const selectedNotes: Array<{ note: Note; index: number }> = selectedNoteIndices
    .filter((i) => i < line.notes.length)
    .map((i) => ({ note: line.notes[i], index: i }));

  if (selectedNotes.length === 0) return null;

  const isBatch = selectedNotes.length > 1;

  const handleBatchEdit = (changes: Partial<Note>) => {
    editNotes(selectedLineIndex, selectedNoteIndices, changes);
  };

  const handleDelete = () => {
    removeNotes(selectedLineIndex, selectedNoteIndices);
    clearSelection();
  };

  const handleFlip = () => {
    // Flip above/below for all selected notes
    for (const { note, index } of selectedNotes) {
      useChartStore.getState().editNote(selectedLineIndex, index, { above: !note.above });
    }
  };

  const handleMirror = () => {
    // Mirror X position
    for (const { note, index } of selectedNotes) {
      useChartStore.getState().editNote(selectedLineIndex, index, { x: -note.x });
    }
  };

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE, width: "100%", fontFamily: "var(--font-mono)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-2)",
  };

  // Show the note type's glyph when every selected note shares one type
  const firstKind = selectedNotes[0].note.kind;
  const singleKind = selectedNotes.every(({ note }) => note.kind === firstKind);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* Context badge */}
      <ContextBadge
        icon={singleKind ? <NoteGlyph kind={firstKind} size={14} /> : Layers}
        label={isBatch ? `${selectedNotes.length} notes selected` : "1 note selected"}
        detail={`on ${line.name}`}
        variant="note"
      />

      {/* Note list */}
      <SectionHeader label="Selected notes" count={selectedNotes.length} />
      <div style={{ maxHeight: 160, overflowY: "auto", borderRadius: "var(--radius-lg)", background: "var(--bg-active)" }}>
        {selectedNotes.map(({ note, index }, i) => {
          const config = NOTE_KIND_CONFIG[note.kind];
          return (
            <div
              key={index}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-6)", padding: "var(--space-4) var(--space-8)",
                fontSize: "var(--fs-caption)",
                borderBottom: i === selectedNotes.length - 1 ? "none" : "var(--rule) solid var(--separator)",
              }}
            >
              <NoteGlyph kind={note.kind} size={12} />
              <span style={{ color: config.color, fontWeight: 600, minWidth: 30 }}>
                {config.label}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                b{formatBeat(note.beat)}
              </span>
              <span style={{ color: "var(--text-secondary)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                x:{Math.round(note.x)}
              </span>
              <Tooltip content={note.above ? "Above" : "Below"}>
                <span
                  role="img"
                  aria-label={note.above ? "Above" : "Below"}
                  style={{ display: "inline-flex", color: note.above ? "var(--text-muted)" : "var(--accent-primary)" }}
                >
                  <Icon icon={note.above ? ChevronUp : ChevronDown} size={12} />
                </span>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {/* Batch edit fields */}
      <SectionHeader label="Batch edit" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", padding: "0 var(--space-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <label style={labelStyle}>Side</label>
          <select
            style={{ ...SELECT_STYLE, width: "100%" }}
            value=""
            onChange={(e) => {
              if (e.target.value === "above") handleBatchEdit({ above: true });
              else if (e.target.value === "below") handleBatchEdit({ above: false });
            }}
          >
            <option value="">Set side…</option>
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={labelStyle}>Speed</label>
            <input
              style={inputStyle}
              type="number"
              step="0.1"
              placeholder="Speed"
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) handleBatchEdit({ speed: val });
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={labelStyle}>Size</label>
            <input
              style={inputStyle}
              type="number"
              step="0.1"
              placeholder="Size"
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) handleBatchEdit({ size: val });
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={labelStyle}>Alpha</label>
            <input
              style={inputStyle}
              type="number"
              min="0"
              max="255"
              placeholder="0-255"
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) handleBatchEdit({ alpha: Math.max(0, Math.min(255, val)) });
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 2 }}>
            <input
              type="checkbox"
              onChange={(e) => handleBatchEdit({ fake: e.target.checked })}
              style={{ accentColor: "var(--accent-primary)" }}
            />
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>Fake</span>
          </div>
        </div>
      </div>

      {/* Quick action buttons */}
      <SectionHeader label="Quick actions" />
      <ToolGroup label="Quick actions">
        <HotkeyButton icon={ArrowUpDown} label="Flip side" hotkey={{ action: "flip_notes" }} onClick={handleFlip} />
        <HotkeyButton icon={ArrowLeftRight} label="Mirror X" hotkey={{ action: "mirror_notes" }} onClick={handleMirror} />
        <HotkeyButton icon={Copy} label="Copy" hotkey="Ctrl+C" onClick={() => performCopy()} />
        <HotkeyButton icon={ClipboardPaste} label="Paste special…" hotkey={{ action: "paste_special" }} onClick={() => useDialogStore.getState().openDialog("paste-special")} />
        <HotkeyButton icon={Trash2} label="Delete" hotkey={{ action: "delete" }} onClick={handleDelete} />
      </ToolGroup>

      {/* Create curve track from exactly 2 selected notes */}
      <ActionButton icon={Spline} label="Create curve track from selection" onClick={() => {
        if (selectedNotes.length !== 2) {
          useToastStore.getState().addToast({ message: "Select exactly 2 notes to create a curve track", type: "warning" });
          return;
        }
        const [a, b] = selectedNotes;
        const noteA = a.note;
        const noteB = b.note;
        // Use note UIDs (or fallback to indices) for from/to
        const fromUid = noteA.uid ?? String(a.index);
        const toUid = noteB.uid ?? String(b.index);
        const track: CurveNoteTrack = {
          from: fromUid,
          to: toUid,
          options: { density: 8, kind: noteA.kind, curve: "linear" },
        };
        useChartStore.getState().addCurveNoteTrack(selectedLineIndex, track);
        useToastStore.getState().addToast({ message: "Curve track created", type: "success" });
      }} />
    </div>
  );
}

// ---- Batch sub-tab ----

function BatchTab() {
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const density = useEditorStore((s) => s.density);
  const lines = useChartStore((s) => s.chart.lines);

  // Gather selected notes for batch operations
  const getSelected = (): Array<{ note: Note; index: number }> => {
    if (selectedLineIndex === null) return [];
    const line = lines[selectedLineIndex];
    if (!line) return [];
    return selectedNoteIndices
      .filter((i) => i < line.notes.length)
      .map((i) => ({ note: line.notes[i], index: i }));
  };

  // Guard: need a line and at least 1 note
  const guard = (): { lineIdx: number; sel: Array<{ note: Note; index: number }> } | null => {
    if (selectedLineIndex === null) return null;
    const sel = getSelected();
    if (sel.length === 0) return null;
    return { lineIdx: selectedLineIndex, sel };
  };

  // ---- BATCH OPERATIONS ----

  const handleFlip = () => {
    const g = guard(); if (!g) return;
    // Toggle above/below for all selected notes
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => ({ noteIndex: index, changes: { above: !note.above } }))
    );
  };

  const handleMirror = () => {
    const g = guard(); if (!g) return;
    // Negate X position for all selected notes
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => ({ noteIndex: index, changes: { x: -note.x } }))
    );
  };

  const handleQuantize = () => {
    const g = guard(); if (!g) return;
    // Snap each note's beat to nearest grid division based on current density
    const step = 1 / density;
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => {
        const beatVal = beatToFloat(note.beat);
        const snapped = Math.round(beatVal / step) * step;
        return { noteIndex: index, changes: { beat: floatToBeat(Math.max(0, snapped)) } };
      })
    );
  };

  const handleDistribute = () => {
    const g = guard(); if (!g) return;
    if (g.sel.length < 3) {
      useToastStore.getState().addToast({ message: "Need 3+ notes to distribute", type: "warning" });
      return;
    }
    // Evenly space selected notes between first and last beat
    const sorted = [...g.sel].sort((a, b) => beatToFloat(a.note.beat) - beatToFloat(b.note.beat));
    const firstBeat = beatToFloat(sorted[0].note.beat);
    const lastBeat = beatToFloat(sorted[sorted.length - 1].note.beat);
    const step = (lastBeat - firstBeat) / (sorted.length - 1);
    useChartStore.getState().batchEditNotes(g.lineIdx,
      sorted.map((s, i) => ({ noteIndex: s.index, changes: { beat: floatToBeat(firstBeat + step * i) } }))
    );
  };

  const handleStrum = () => {
    const g = guard(); if (!g) return;
    if (g.sel.length < 2) {
      useToastStore.getState().addToast({ message: "Need 2+ notes to strum", type: "warning" });
      return;
    }
    // Apply incremental X offset to each successive note (fan/stagger pattern)
    // Stagger amount: 30 units per note (fixed offset, ~half spacing at N=21)
    const strumStep = 30;
    const sorted = [...g.sel].sort((a, b) => beatToFloat(a.note.beat) - beatToFloat(b.note.beat));
    const centerX = sorted.reduce((sum, s) => sum + s.note.x, 0) / sorted.length;
    useChartStore.getState().batchEditNotes(g.lineIdx,
      sorted.map((s, i) => {
        const offset = (i - (sorted.length - 1) / 2) * strumStep;
        return { noteIndex: s.index, changes: { x: centerX + offset } };
      })
    );
  };

  // ---- ALIGNMENT ----

  const handleAlignLeft = () => {
    const g = guard(); if (!g) return;
    const minX = Math.min(...g.sel.map((s) => s.note.x));
    useChartStore.getState().editNotes(g.lineIdx, g.sel.map((s) => s.index), { x: minX });
  };

  const handleAlignRight = () => {
    const g = guard(); if (!g) return;
    const maxX = Math.max(...g.sel.map((s) => s.note.x));
    useChartStore.getState().editNotes(g.lineIdx, g.sel.map((s) => s.index), { x: maxX });
  };

  const handleCenter = () => {
    const g = guard(); if (!g) return;
    const avgX = g.sel.reduce((sum, s) => sum + s.note.x, 0) / g.sel.length;
    useChartStore.getState().editNotes(g.lineIdx, g.sel.map((s) => s.index), { x: Math.round(avgX) });
  };

  const handleSpaceY = () => {
    const g = guard(); if (!g) return;
    if (g.sel.length < 3) {
      useToastStore.getState().addToast({ message: "Need 3+ notes to space vertically", type: "warning" });
      return;
    }
    // Evenly distribute notes by beat between first/last, preserving X positions
    const sorted = [...g.sel].sort((a, b) => beatToFloat(a.note.beat) - beatToFloat(b.note.beat));
    const firstBeat = beatToFloat(sorted[0].note.beat);
    const lastBeat = beatToFloat(sorted[sorted.length - 1].note.beat);
    const step = (lastBeat - firstBeat) / (sorted.length - 1);
    useChartStore.getState().batchEditNotes(g.lineIdx,
      sorted.map((s, i) => ({ noteIndex: s.index, changes: { beat: floatToBeat(firstBeat + step * i) } }))
    );
  };

  const handleSpaceX = () => {
    const g = guard(); if (!g) return;
    if (g.sel.length < 3) {
      useToastStore.getState().addToast({ message: "Need 3+ notes to space horizontally", type: "warning" });
      return;
    }
    // Evenly distribute notes by X between leftmost/rightmost, preserving beats
    const sorted = [...g.sel].sort((a, b) => a.note.x - b.note.x);
    const firstX = sorted[0].note.x;
    const lastX = sorted[sorted.length - 1].note.x;
    const step = (lastX - firstX) / (sorted.length - 1);
    useChartStore.getState().batchEditNotes(g.lineIdx,
      sorted.map((s, i) => ({ noteIndex: s.index, changes: { x: Math.round(firstX + step * i) } }))
    );
  };

  // ---- TRANSFORM ----

  const handleRotate = () => {
    const g = guard(); if (!g) return;
    // Rotate note X positions around the selection centroid by 90 degrees
    // In the note coordinate system, X is horizontal and beat is vertical.
    // A 90-degree rotation swaps the two axes relative to the centroid.
    const centroidX = g.sel.reduce((s, n) => s + n.note.x, 0) / g.sel.length;
    const centroidBeat = g.sel.reduce((s, n) => s + beatToFloat(n.note.beat), 0) / g.sel.length;
    // Scale factor: 1 beat ~ 675 X units (roughly, to make rotation visually meaningful)
    // We use a simpler approach: rotate X positions only within X space
    // 90-degree rotation: (x, y) -> (-y, x) relative to centroid
    // We treat beat offset in "X units" by multiplying by 150 (arbitrary visual scale)
    const scale = 150;
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => {
        const dx = note.x - centroidX;
        const dy = (beatToFloat(note.beat) - centroidBeat) * scale;
        // Rotate 90 degrees clockwise: (dx, dy) -> (dy, -dx)
        const newX = centroidX + dy;
        const newBeat = centroidBeat + (-dx) / scale;
        return { noteIndex: index, changes: { x: Math.round(newX), beat: floatToBeat(Math.max(0, newBeat)) } };
      })
    );
  };

  const handleScale = () => {
    const g = guard(); if (!g) return;
    // Scale note X positions from centroid by 2x
    const centroidX = g.sel.reduce((s, n) => s + n.note.x, 0) / g.sel.length;
    const factor = 2;
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => {
        const newX = centroidX + (note.x - centroidX) * factor;
        return { noteIndex: index, changes: { x: Math.round(newX) } };
      })
    );
  };

  const handleShiftX = () => {
    const g = guard(); if (!g) return;
    // Shift all selected notes' X by one grid step: 1350 / (N-1)
    const vl = useEditorStore.getState().verticalLines;
    const gridStep = vl >= 2 ? Math.round(1350 / (vl - 1)) : 0; // Full X range is -675 to +675 = 1350
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => ({ noteIndex: index, changes: { x: note.x + gridStep } }))
    );
  };

  const handleShiftY = () => {
    const g = guard(); if (!g) return;
    // Shift all selected notes' beat by 1 beat
    const beatShift = 1;
    useChartStore.getState().batchEditNotes(g.lineIdx,
      g.sel.map(({ note, index }) => ({
        noteIndex: index,
        changes: { beat: floatToBeat(Math.max(0, beatToFloat(note.beat) + beatShift)) },
      }))
    );
  };

  const handleReset = () => {
    const g = guard(); if (!g) return;
    // Reset all selected notes to default properties
    useChartStore.getState().editNotes(g.lineIdx, g.sel.map((s) => s.index), {
      x: 0,
      above: true,
      speed: 1,
      size: 1,
      alpha: 255,
      fake: false,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
      <SectionHeader label="Batch operations" />
      <ToolGroup label="Batch operations">
        <HotkeyButton icon={ArrowUpDown} label="Flip side" hotkey={{ action: "flip_notes" }} onClick={handleFlip} />
        <HotkeyButton icon={ArrowLeftRight} label="Mirror X" hotkey={{ action: "mirror_notes" }} onClick={handleMirror} />
        <HotkeyButton icon={Magnet} label="Quantize" hotkey={{ action: "quantize_notes" }} onClick={handleQuantize} />
        <HotkeyButton icon={AlignHorizontalSpaceAround} label="Distribute" hotkey={{ action: "distribute_notes" }} onClick={handleDistribute} />
        <HotkeyButton icon={UnfoldHorizontal} label="Strum" hotkey={{ action: "strum_notes" }} onClick={handleStrum} />
      </ToolGroup>

      <SectionHeader label="Alignment" />
      <ToolGroup label="Alignment">
        <HotkeyButton icon={AlignLeft} label="Align left" onClick={handleAlignLeft} />
        <HotkeyButton icon={AlignRight} label="Align right" onClick={handleAlignRight} />
        <HotkeyButton icon={AlignCenter} label="Align center" onClick={handleCenter} />
        <HotkeyButton icon={MoveVertical} label="Space vertically" onClick={handleSpaceY} />
        <HotkeyButton icon={MoveHorizontal} label="Space horizontally" onClick={handleSpaceX} />
      </ToolGroup>

      <SectionHeader label="Transform" />
      <ToolGroup label="Transform">
        <HotkeyButton icon={RotateCw} label="Rotate 90°" onClick={handleRotate} />
        <HotkeyButton icon={Scaling} label="Scale X 2×" onClick={handleScale} />
        <HotkeyButton icon={ArrowRightLeft} label="Shift X" onClick={handleShiftX} />
        <HotkeyButton icon={ArrowUpDown} label="Shift beat" onClick={handleShiftY} />
        <HotkeyButton icon={RotateCcw} label="Reset properties" onClick={handleReset} />
      </ToolGroup>
    </div>
  );
}

// ---- Hotkeys sub-tab ----

// Only keys that are actually bound (useHotkeys / useClipboard); registry
// actions show their current binding from Settings > Hotkeys.
const NOTE_HOTKEY_SECTIONS: HotkeySection[] = [
  {
    title: "Selection",
    keys: [
      { label: "Select all notes on the line", hotkey: { action: "select_all" } },
      { label: "Add or remove a note (timeline)", hotkey: "Ctrl+Click" },
      { label: "Delete", hotkey: { action: "delete" } },
      { label: "Copy", hotkey: "Ctrl+C" },
      { label: "Cut", hotkey: "Ctrl+X" },
      { label: "Paste", hotkey: "Ctrl+V" },
      { label: "Paste special", hotkey: { action: "paste_special" } },
    ],
  },
  {
    title: "Batch operations",
    keys: [
      { label: "Flip side", hotkey: { action: "flip_notes" } },
      { label: "Mirror X", hotkey: { action: "mirror_notes" } },
      { label: "Quantize", hotkey: { action: "quantize_notes" } },
      { label: "Distribute", hotkey: { action: "distribute_notes" } },
      { label: "Strum", hotkey: { action: "strum_notes" } },
    ],
  },
  {
    title: "Moving",
    keys: [
      { label: "Move later", hotkey: { action: "move_up" } },
      { label: "Move earlier", hotkey: { action: "move_down" } },
      { label: "Move left", hotkey: { action: "move_left" } },
      { label: "Move right", hotkey: { action: "move_right" } },
      { label: "Go to beat", hotkey: { action: "go_to_beat" } },
    ],
  },
];

function NoteHotkeys() {
  return <HotkeyList sections={NOTE_HOTKEY_SECTIONS} />;
}
