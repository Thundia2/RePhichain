// ============================================================
// Kbd — keyboard shortcut chip ("Ctrl+Shift+Z"), mono, 10px.
// ActionKbd shows a registry action's current binding, so it follows
// a rebind in Settings > Hotkeys.
// ============================================================

import type React from "react";
import { useHotkeyLabel, useShortcutText, type ShortcutRef } from "../../hooks/useHotkeyLabel";

export function Kbd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <kbd className="ui-kbd" style={style}>
      {children}
    </kbd>
  );
}

/** Chip for a rebindable shortcut: `<ActionKbd action="go_to_beat" />`. */
export function ActionKbd({ action, style }: { action: string; style?: React.CSSProperties }) {
  return <Kbd style={style}>{useHotkeyLabel(action)}</Kbd>;
}

/** Chip for fixed key text or a `{ action }` registry shortcut. */
export function ShortcutKbd({ value, style }: { value: ShortcutRef; style?: React.CSSProperties }) {
  return <Kbd style={style}>{useShortcutText()(value)}</Kbd>;
}
