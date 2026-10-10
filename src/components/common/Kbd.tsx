// ============================================================
// Kbd — keyboard shortcut chip ("Ctrl+Shift+Z"), mono, 10px.
// ============================================================

import type React from "react";

export function Kbd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <kbd className="ui-kbd" style={style}>
      {children}
    </kbd>
  );
}
