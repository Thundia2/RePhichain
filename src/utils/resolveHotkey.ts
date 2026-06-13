// ============================================================
// Hotkey resolution (finding L7) — the single bridge between the registry +
// user overrides and the actual react-hotkeys-hook bindings.
//
// Before L7, useHotkeys.ts hardcoded every key string and never read
// settingsStore.hotkeyOverrides, so the whole rebinding feature (the overrides
// store API + the HotkeySettings capture panel + its conflict checker) was inert:
// you could "rebind" in the UI and nothing changed. Now each binding resolves its
// key through here.
//
// Reactivity: callers SUBSCRIBE to `hotkeyOverrides` (useSettingsStore selector) and
// pass the live map in, so a rebind re-renders the hook and react-hotkeys-hook swaps
// its listener (its effect deps include the keys string — verified in the vendored
// react-hotkeys-hook). grep resolveHotkey / hk(.
// ============================================================

import { DEFAULT_HOTKEYS } from "../constants/defaultHotkeys";

/**
 * The active key string for an action id: a user override wins, else the registry
 * default. Returns "" for an unknown id (react-hotkeys-hook treats "" as "never
 * matches", so a typo'd id is inert rather than crashing).
 */
export function resolveHotkey(overrides: Record<string, string>, actionId: string): string {
  return overrides[actionId] ?? DEFAULT_HOTKEYS[actionId]?.key ?? "";
}
