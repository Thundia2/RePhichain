// ============================================================
// Group Manager — Shared Constants & Styles
//
// Constants and styles used by GroupManager and its extracted
// sub-components (LineBatchOps, NoteBatchOps, GroupRow).
// ============================================================

import type { LineEventKind, NoteKind } from "../../types/chart";
import { INPUT_STYLE as UIK_INPUT_STYLE, SELECT_STYLE as UIK_SELECT_STYLE } from "../common/UIKit";

// ---- Data Constants ----

export const EVENT_KINDS: { value: LineEventKind; label: string }[] = [
  { value: "x", label: "X" },
  { value: "y", label: "Y" },
  { value: "rotation", label: "Rotation" },
  { value: "opacity", label: "Opacity" },
  { value: "speed", label: "Speed" },
  { value: "scale_x", label: "Scale X" },
  { value: "scale_y", label: "Scale Y" },
];

export const NOTE_KINDS: { value: NoteKind; label: string }[] = [
  { value: "tap", label: "Tap" },
  { value: "drag", label: "Drag" },
  { value: "flick", label: "Flick" },
  { value: "hold", label: "Hold" },
];

// ---- Shared Styles ----

export const SECTION_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "var(--space-6)",
  marginTop: "var(--space-12)",
};

export const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--bg-active)",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
  marginBottom: "var(--space-8)",
};

export const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--space-8)",
  padding: "var(--space-6) var(--space-10)",
  borderBottom: "var(--rule) solid var(--separator)",
  fontSize: "var(--fs-control)",
};

export const INPUT_STYLE = UIK_INPUT_STYLE;
export const SELECT_STYLE = UIK_SELECT_STYLE;

const BTN_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-6)",
  height: "var(--control-md)",
  padding: "0 var(--space-10)",
  fontSize: "var(--fs-control)",
  fontWeight: 500,
  border: "none",
  borderRadius: "var(--radius-md)",
  cursor: "pointer",
};

export const BTN_ACCENT_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  fontWeight: 600,
  background: "var(--accent-primary)",
  color: "var(--on-accent)",
};

export const BTN_MUTED_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-active)",
  color: "var(--text-primary)",
};

export const BTN_DANGER_STYLE: React.CSSProperties = {
  ...BTN_BASE,
  background: "var(--bg-active)",
  color: "var(--error)",
};
