// ============================================================
// Shortcut display text that follows Settings > Hotkeys.
//
// Anything that prints a rebindable shortcut (tooltips, menus, the
// hotkey reference, guide text) reads it from here instead of a
// literal, so a rebind shows up everywhere at once:
//
//   const key = useHotkeyLabel("go_to_beat");   // "Ctrl+G"
//   const hk = useHotkeyLabels(); hk("undo");     // several at once
//   <IconButton shortcut={{ action: "save" }} …/> // Tooltip, IconButton,
//                                                 // HotkeyButton, HotkeyList
//
// Shortcuts that are not in DEFAULT_HOTKEYS are fixed and stay literal
// strings.
// ============================================================

import { useSettingsStore } from "../stores/settingsStore";
import { resolveHotkey } from "../utils/resolveHotkey";
import { formatHotkeyDisplay } from "../constants/defaultHotkeys";

/** Display text ("Ctrl+G") for a registry action under the given overrides. */
export function hotkeyLabel(overrides: Record<string, string>, actionId: string): string {
  return formatHotkeyDisplay(resolveHotkey(overrides, actionId));
}

/** Live display text for one registry action's current binding. */
export function useHotkeyLabel(actionId: string): string {
  const overrides = useSettingsStore((s) => s.hotkeyOverrides);
  return hotkeyLabel(overrides, actionId);
}

/** A shortcut to display: fixed text, or a registry action that may be rebound. */
export type ShortcutRef = string | { action: string };

/** Live resolver for ShortcutRefs (fixed text passes through). */
export function useShortcutText(): (ref: ShortcutRef | undefined) => string | undefined {
  const overrides = useSettingsStore((s) => s.hotkeyOverrides);
  return (ref) => (ref === undefined || typeof ref === "string" ? ref : hotkeyLabel(overrides, ref.action));
}

/** Live lookup for several registry actions. */
export function useHotkeyLabels(): (actionId: string) => string {
  const overrides = useSettingsStore((s) => s.hotkeyOverrides);
  return (actionId) => hotkeyLabel(overrides, actionId);
}
