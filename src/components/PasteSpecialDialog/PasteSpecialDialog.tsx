// ============================================================
// Paste Special Dialog
//
// Ctrl+Alt+V opens this modal. Allows pasting clipboard contents
// with transformations: mirror X, flip above/below, beat scaling,
// X offset, and beat offset. Rendered in the shared Dialog chrome.
// ============================================================

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { getSelectedLineIndex } from "../../stores/selection";
import { useChartStore } from "../../stores/chartStore";
import { getPlayheadBeat } from "../../utils/playhead";
import { getClipboard } from "../../hooks/useClipboard";
import { beatToFloat, floatToBeat } from "../../types/chart";
import type { Note, LineEvent } from "../../types/chart";
import { NumericInput } from "../common/FormFields";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { ActionKbd } from "../common/Kbd";
import { INPUT_STYLE } from "../common/UIKit";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PasteSpecialDialog({ open, onClose }: Props) {
  const [mirrorX, setMirrorX] = useState(false);
  const [flipAboveBelow, setFlipAboveBelow] = useState(false);
  const [beatScale, setBeatScale] = useState(1.0);
  const [xOffset, setXOffset] = useState(0);
  const [beatOffset, setBeatOffset] = useState(0);

  if (!open) return null;

  const clipboard = getClipboard();
  const hasData = clipboard !== null && (clipboard.notes.length > 0 || clipboard.events.length > 0);

  const handleApply = () => {
    if (!clipboard) return;
    const cs = useChartStore.getState();
    const selectedLineIndex = getSelectedLineIndex();
    if (selectedLineIndex === null) return;

    // Compute paste offset: paste at the current playback position
    const currentBeat = getPlayheadBeat();

    // The base beat from clipboard is the earliest item's beat
    const baseBeat = clipboard.baseBeat;

    // Paste notes with transforms
    for (const note of clipboard.notes) {
      const origBeat = beatToFloat(note.beat);
      // Scale the beat relative to baseBeat, then apply beat offset, then shift to playhead
      const scaledBeat = baseBeat + (origBeat - baseBeat) * beatScale;
      const finalBeat = scaledBeat - baseBeat + currentBeat + beatOffset;

      const pasted: Note = {
        ...structuredClone(note),
        beat: floatToBeat(Math.max(0, finalBeat)),
        x: (mirrorX ? -note.x : note.x) + xOffset,
        above: flipAboveBelow ? !note.above : note.above,
      };

      // Scale hold_beat if present
      if (pasted.hold_beat && beatScale !== 1.0) {
        const holdF = beatToFloat(pasted.hold_beat);
        pasted.hold_beat = floatToBeat(Math.max(0, holdF * beatScale));
      }

      cs.addNote(selectedLineIndex!, pasted);
    }

    // Paste events with transforms
    for (const event of clipboard.events) {
      const origStart = beatToFloat(event.start_beat);
      const origEnd = beatToFloat(event.end_beat);
      const origDuration = origEnd - origStart;

      // Scale and offset the start beat
      const scaledStart = baseBeat + (origStart - baseBeat) * beatScale;
      const finalStart = scaledStart - baseBeat + currentBeat + beatOffset;
      const finalDuration = origDuration * beatScale;

      const pasted: LineEvent = {
        ...structuredClone(event),
        start_beat: floatToBeat(Math.max(0, finalStart)),
        end_beat: floatToBeat(Math.max(0, finalStart + finalDuration)),
      };

      // SW2: x events carry a horizontal position, so apply the same Mirror X / X-offset
      // the notes get above. The dialog only transformed event BEATS before, leaving x
      // events un-mirrored/un-offset (the label is "negate horizontal position").
      if (event.kind === "x" && (mirrorX || xOffset !== 0)) {
        const tx = (v: number) => (mirrorX ? -v : v) + xOffset;
        if ("constant" in pasted.value) {
          pasted.value = { constant: tx(pasted.value.constant) };
        } else if ("transition" in pasted.value) {
          const t = pasted.value.transition;
          pasted.value = { transition: { ...t, start: tx(t.start), end: tx(t.end) } };
        }
      }

      cs.addEvent(selectedLineIndex!, pasted);
    }

    onClose();
  };

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE,
    width: "100%",
    marginTop: "var(--space-6)",
    fontFamily: "var(--font-mono)",
  };

  const fieldLabelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--fs-control)",
    color: "var(--text-secondary)",
  };

  const checkboxRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-8)",
    color: "var(--text-primary)",
    fontSize: "var(--fs-body)",
    cursor: "pointer",
  };

  return (
    <Dialog
      title="Paste special"
      icon={ClipboardPaste}
      onClose={onClose}
      width={320}
      headerExtra={<ActionKbd action="paste_special" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleApply} disabled={!hasData}>
            Apply
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
        {!hasData && (
          <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-body)", textAlign: "center", padding: "var(--space-8) 0" }}>
            Nothing in clipboard. Copy notes/events first (Ctrl+C).
          </div>
        )}

        {hasData && (
          <>
            <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-control)" }}>
              Clipboard: {clipboard!.notes.length} note(s), {clipboard!.events.length} event(s)
            </div>

            {/* Checkboxes */}
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={mirrorX}
                onChange={(e) => setMirrorX(e.target.checked)}
              />
              Mirror X (negate horizontal position)
            </label>

            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={flipAboveBelow}
                onChange={(e) => setFlipAboveBelow(e.target.checked)}
              />
              Flip above/below
            </label>

            {/* Number inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
              <label style={fieldLabelStyle}>
                Beat scale factor
                <NumericInput
                  commitMode="blur"
                  step="0.1"
                  min={0.1}
                  fallback={1}
                  value={beatScale}
                  onChange={setBeatScale}
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabelStyle}>
                X offset
                <NumericInput
                  commitMode="blur"
                  step="10"
                  fallback={0}
                  value={xOffset}
                  onChange={setXOffset}
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabelStyle}>
                Beat offset
                <NumericInput
                  commitMode="blur"
                  step="0.25"
                  fallback={0}
                  value={beatOffset}
                  onChange={setBeatOffset}
                  style={inputStyle}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
