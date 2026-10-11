// ============================================================
// SelectionSummary — what the context panel is acting on
// ("Line 3 · 42 notes"). A bg-active card with no border.
// ============================================================

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export function SelectionSummary({
  icon,
  label,
  detail,
  style,
}: {
  icon?: LucideIcon | React.ReactNode;
  label: React.ReactNode;
  detail?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const isLucide = typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in icon);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        padding: "var(--space-8) var(--space-10)",
        marginBottom: "var(--space-8)",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-active)",
        fontSize: "var(--fs-control)",
        ...style,
      }}
    >
      {icon && (
        <span style={{ display: "inline-flex", color: "var(--accent-primary)" }}>
          {isLucide ? <Icon icon={icon as LucideIcon} /> : (icon as React.ReactNode)}
        </span>
      )}
      <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {detail && (
        <span style={{ marginLeft: "auto", fontSize: "var(--fs-caption)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {detail}
        </span>
      )}
    </div>
  );
}
