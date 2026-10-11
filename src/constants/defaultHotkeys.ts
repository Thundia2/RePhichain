// ============================================================
// Default Hotkey Definitions
//
// Central registry of all keyboard shortcuts with their
// default bindings, display labels, and categories.
//
// Format uses react-hotkeys-hook syntax:
//   "ctrl+z" — modifier + key
//   "v"      — plain key
//   "delete, backspace" — multiple keys for same action
//
// Recent change: Added Shift+O for toggle onset detection.
// ============================================================

export interface HotkeyDefinition {
  /** react-hotkeys-hook key string (e.g., "ctrl+z", "v") */
  key: string;
  /** Human-readable label for the settings UI */
  label: string;
  /** Category for grouping in the settings panel */
  category: string;
}

export const HOTKEY_CATEGORIES = [
  "Tools",
  "Edit",
  "File",
  "Selection",
  "Notes",
  "Events",
  "Navigation",
  "Playback",
  "View",
] as const;

export type HotkeyCategory = (typeof HOTKEY_CATEGORIES)[number];

/**
 * Map of action IDs to their default hotkey definitions.
 * Action IDs are stable identifiers used throughout the codebase.
 */
export const DEFAULT_HOTKEYS: Record<string, HotkeyDefinition> = {
  // ---- Tools ----
  select_tool: { key: "v", label: "Select tool", category: "Tools" },
  eraser_tool: { key: "x", label: "Eraser tool", category: "Tools" },
  place_tap: { key: "q", label: "Place tap note", category: "Tools" },
  place_drag: { key: "w", label: "Place drag note", category: "Tools" },
  place_flick: { key: "e", label: "Place flick note", category: "Tools" },
  place_hold: { key: "r", label: "Place hold note", category: "Tools" },
  // L7: displaced here when the registry reclaimed their old keys (s -> split_event,
  // ctrl+g -> go_to_beat). New homes chosen by the user. grep step_record/pattern_tool.
  step_record: { key: "b", label: "Toggle step record", category: "Tools" },
  pattern_tool: { key: "p", label: "Toggle pattern tool", category: "Tools" },

  // ---- Edit ----
  undo: { key: "ctrl+z, meta+z", label: "Undo", category: "Edit" },
  // ctrl+y is a real working redo alias in the code; fold it in so the registry is the
  // true superset (registry-authoritative) and rebinding doesn't silently drop it.
  redo: { key: "ctrl+shift+z, meta+shift+z, ctrl+y", label: "Redo", category: "Edit" },
  delete: { key: "delete, backspace", label: "Delete selected", category: "Edit" },
  select_all: { key: "ctrl+a, meta+a", label: "Select all", category: "Edit" },

  // ---- File ----
  save: { key: "ctrl+s, meta+s", label: "Save project", category: "File" },
  new_chart: { key: "ctrl+n, meta+n", label: "New chart", category: "File" },

  // ---- Notes ----
  flip_notes: { key: "f", label: "Flip notes (above/below)", category: "Notes" },
  mirror_notes: { key: "m", label: "Mirror notes (X axis)", category: "Notes" },
  quantize_notes: { key: "ctrl+q, meta+q", label: "Quantize notes", category: "Notes" },
  distribute_notes: { key: "ctrl+d, meta+d", label: "Distribute notes evenly", category: "Notes" },
  strum_notes: { key: "ctrl+shift+s, meta+shift+s", label: "Strum notes", category: "Notes" },

  // ---- Events ----
  split_event: { key: "s", label: "Split event", category: "Events" },
  // (merge_events / swap_easing removed in L7 — no underlying operation existed
  //  anywhere in the codebase; they were registry-only orphans showing dead settings
  //  rows. Re-add with a real handler if those ops are ever implemented.)

  // ---- Navigation ----
  move_up: { key: "up", label: "Move selection forward", category: "Navigation" },
  move_down: { key: "down", label: "Move selection backward", category: "Navigation" },
  move_right: { key: "right", label: "Move selection right", category: "Navigation" },
  move_left: { key: "left", label: "Move selection left", category: "Navigation" },
  go_to_beat: { key: "ctrl+g, meta+g", label: "Go to beat…", category: "Navigation" },
  // ctrl+up/down, NOT ctrl+[/] : react-hotkeys-hook needs useKey:true to match "[",
  // and that flag's single-key short-circuit then fires on a BARE "[" (loop_start), so
  // ctrl+[ would collide with the loop key. Arrow combos sidestep the quirk entirely.
  prev_marker: { key: "ctrl+up, meta+up", label: "Previous marker", category: "Navigation" },
  next_marker: { key: "ctrl+down, meta+down", label: "Next marker", category: "Navigation" },

  // ---- Playback ----
  toggle_playback: { key: "space", label: "Play / pause", category: "Playback" },
  loop_start: { key: "[", label: "Set loop start", category: "Playback" },
  loop_end: { key: "]", label: "Set loop end", category: "Playback" },
  toggle_loop: { key: "\\", label: "Toggle loop", category: "Playback" },

  // ---- View ----
  open_unrolled: { key: "ctrl+shift+u, meta+shift+u", label: "Open unrolled editor", category: "View" },
  enter_group_edit: { key: "g", label: "Enter group edit / toggle mini preview", category: "View" },
  toggle_onset_detection: { key: "shift+o", label: "Toggle onset detection", category: "View" },
  toggle_devtools: { key: "f12", label: "Toggle DevTools", category: "View" },
  add_section_marker: { key: "ctrl+b, meta+b", label: "Add section marker", category: "View" },
  paste_special: { key: "ctrl+alt+v, meta+alt+v", label: "Paste special…", category: "Edit" },
  cross_line_paste: { key: "ctrl+shift+v, meta+shift+v", label: "Paste to selected lines", category: "Edit" },
};

/**
 * Returns a display-friendly version of a hotkey string.
 * e.g., "ctrl+shift+z" -> "Ctrl+Shift+Z"
 */
export function formatHotkeyDisplay(key: string): string {
  // Take only the first combo if there are multiple (e.g., "ctrl+z, meta+z")
  const first = key.split(",")[0].trim();
  return first
    .split("+")
    .map((part) => {
      const p = part.trim().toLowerCase();
      if (p === "ctrl" || p === "meta") return "Ctrl";
      if (p === "shift") return "Shift";
      if (p === "alt") return "Alt";
      if (p === "space") return "Space";
      if (p === "delete") return "Del";
      if (p === "backspace") return "Backspace";
      if (p === "up") return "Up";
      if (p === "down") return "Down";
      if (p === "left") return "Left";
      if (p === "right") return "Right";
      return p.toUpperCase();
    })
    .join("+");
}

/**
 * Returns grouped hotkeys by category for display in settings.
 */
export function getHotkeysByCategory(): Record<string, { action: string; def: HotkeyDefinition }[]> {
  const groups: Record<string, { action: string; def: HotkeyDefinition }[]> = {};
  for (const [action, def] of Object.entries(DEFAULT_HOTKEYS)) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push({ action, def });
  }
  return groups;
}
