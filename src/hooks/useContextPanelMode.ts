// ============================================================
// useContextPanelMode — Derived hook
//
// Computes the active context panel mode from editorStore
// selection state. Auto-switches as the user selects different
// things in the editor.
//
// Recent change: Added AI tab to every mode. The tab is
// conditionally included based on the aiEnabled setting.
// ============================================================

import { CircleDot, Diamond, Ellipsis, Keyboard, Layers, Minus, Music2, Sparkles, type LucideIcon } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import {
  useSelectedLineIndex,
  useSelectedNoteIndices,
  useSelectedEventIndices,
  useMultiSelectedLineIndices,
} from "../stores/selection";

export type ContextPanelMode = "global" | "line" | "note" | "event" | "multi";

export function useContextPanelMode(): ContextPanelMode {
  // Resolved (present-entity) selection so a deleted-but-not-cleared id can't
  // pin the panel to a stale mode (finding L2).
  const selectedLineIndex = useSelectedLineIndex();
  const selectedNoteIndices = useSelectedNoteIndices();
  const selectedEventIndices = useSelectedEventIndices();
  const multiSelectedLineIndices = useMultiSelectedLineIndices();

  if (multiSelectedLineIndices.length > 1) return "multi";
  if (selectedEventIndices.length > 0) return "event";
  if (selectedNoteIndices.length > 0) return "note";
  if (selectedLineIndex !== null) return "line";
  return "global";
}

/** Labels and icons for each mode */
export const MODE_CONFIG: Record<ContextPanelMode, { label: string; icon: LucideIcon }> = {
  global: { label: "Chart", icon: Music2 },
  line: { label: "Line", icon: Minus },
  note: { label: "Notes", icon: Diamond },
  event: { label: "Event", icon: CircleDot },
  multi: { label: "Lines", icon: Layers },
};

/** A context-panel tab. `icon` alone (no visible label) for compact tabs. */
export interface ModeTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Hide the text label and show only the icon (label stays the accessible name). */
  iconOnly?: boolean;
}

/** AI tab definition — shared across all modes */
const AI_TAB: ModeTab = { id: "ai", label: "AI", icon: Sparkles };
const HOTKEYS_TAB: ModeTab = { id: "hotkeys", label: "Hotkeys", icon: Keyboard, iconOnly: true };
const MISC_TAB: ModeTab = { id: "misc", label: "More tools", icon: Ellipsis, iconOnly: true };

/** Base tab definitions per mode (without AI tab) */
const BASE_MODE_TABS: Record<ContextPanelMode, ModeTab[]> = {
  global: [
    { id: "actions", label: "Actions" },
    HOTKEYS_TAB,
    MISC_TAB,
  ],
  line: [
    { id: "events", label: "Events" },
    { id: "props", label: "Properties" },
    { id: "controls", label: "Controls" },
    { id: "presets", label: "Presets" },
    { id: "note-gen", label: "Generate" },
    HOTKEYS_TAB,
    MISC_TAB,
  ],
  note: [
    { id: "edit", label: "Edit" },
    { id: "batch", label: "Batch" },
    HOTKEYS_TAB,
    MISC_TAB,
  ],
  event: [
    { id: "edit", label: "Edit" },
    { id: "easing", label: "Easing" },
    HOTKEYS_TAB,
    MISC_TAB,
  ],
  multi: [
    { id: "batch", label: "Batch" },
    { id: "offset", label: "Offset" },
    HOTKEYS_TAB,
    MISC_TAB,
  ],
};

/**
 * Get tab definitions for a mode, conditionally including the AI tab.
 * The AI tab is inserted before the last two tabs (hotkeys, misc) in each mode.
 */
export function getModeTabs(
  mode: ContextPanelMode,
  aiEnabled: boolean = useSettingsStore.getState().aiEnabled,
): ModeTab[] {
  const baseTabs = BASE_MODE_TABS[mode];
  if (!aiEnabled) return baseTabs;
  // Insert AI tab before "hotkeys" and "misc" (last 2 items)
  const insertIdx = Math.max(0, baseTabs.length - 2);
  return [
    ...baseTabs.slice(0, insertIdx),
    AI_TAB,
    ...baseTabs.slice(insertIdx),
  ];
}

/**
 * MODE_TABS is still exported for backward compat, but components
 * should prefer getModeTabs() which respects the aiEnabled setting.
 * This always includes the AI tab for type checking purposes.
 */
export const MODE_TABS: Record<ContextPanelMode, ModeTab[]> = {
  global: [...BASE_MODE_TABS.global.slice(0, -2), AI_TAB, ...BASE_MODE_TABS.global.slice(-2)],
  line: [...BASE_MODE_TABS.line.slice(0, -2), AI_TAB, ...BASE_MODE_TABS.line.slice(-2)],
  note: [...BASE_MODE_TABS.note.slice(0, -2), AI_TAB, ...BASE_MODE_TABS.note.slice(-2)],
  event: [...BASE_MODE_TABS.event.slice(0, -2), AI_TAB, ...BASE_MODE_TABS.event.slice(-2)],
  multi: [...BASE_MODE_TABS.multi.slice(0, -2), AI_TAB, ...BASE_MODE_TABS.multi.slice(-2)],
};
