// ============================================================
// ToolGroup — a filled strip of IconButtons (bg-active, radius-lg).
// ============================================================

import type React from "react";

export function ToolGroup({
  children,
  label,
  vertical,
  style,
}: {
  children: React.ReactNode;
  /** Accessible name for the toolbar. */
  label?: string;
  vertical?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={vertical ? "ui-tool-group ui-tool-group--vertical" : "ui-tool-group"}
      style={style}
    >
      {children}
    </div>
  );
}
