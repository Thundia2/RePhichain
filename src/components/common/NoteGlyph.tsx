// ============================================================
// NoteGlyph — a note type drawn as its own bar shape in its note
// colour. Used wherever a note type is picked or shown (tool rail,
// type pickers, legends) instead of a generic icon.
// ============================================================

import type { NoteKind } from "../../types/chart";

const NOTE_VARS: Record<NoteKind, string> = {
  tap: "var(--note-tap)",
  drag: "var(--note-drag)",
  flick: "var(--note-flick)",
  hold: "var(--note-hold)",
};

export function NoteGlyph({
  kind,
  size = 16,
  color,
}: {
  kind: NoteKind;
  /** Bounding box in px (the bar is drawn inside it). */
  size?: number;
  /** Override the note colour (e.g. the below-line palette). */
  color?: string;
}) {
  const fill = color ?? NOTE_VARS[kind];
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" focusable={false} style={{ flexShrink: 0 }}>
      {kind === "tap" && <rect x={0} y={6} width={16} height={4} rx={1.5} fill={fill} />}
      {kind === "drag" && <rect x={0} y={6.5} width={16} height={3} rx={1.5} fill={fill} />}
      {kind === "flick" && (
        <>
          <path d="M5 4.5 8 1.5 11 4.5z" fill={fill} />
          <rect x={0} y={7} width={16} height={4} rx={1.5} fill={fill} />
        </>
      )}
      {kind === "hold" && <rect x={5.5} y={0} width={5} height={16} rx={1.5} fill={fill} />}
    </svg>
  );
}
