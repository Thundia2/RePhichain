// ============================================================
// Shared UI Kit — Design language primitives
//
// Extracted from SettingsModal, GroupManager, TransportBar.
// Every drawer panel and editor component should use these
// instead of raw HTML to maintain visual consistency.
// ============================================================

import { Children, cloneElement, isValidElement } from "react";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

/* ── Style Constants ── */

// eslint-disable-next-line react-refresh/only-export-components
export const INPUT_STYLE: React.CSSProperties = {
  height: 24,
  padding: "4px 8px",
  borderRadius: 6,
  fontSize: 11,
  border: "0.5px solid var(--border-color)",
  backgroundColor: "var(--bg-tertiary)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
};

// eslint-disable-next-line react-refresh/only-export-components
export const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
};

/* ── Card ── */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-active)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        marginBottom: "var(--space-8)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── CardRow ── */

export function CardRow({
  label,
  description,
  children,
  last = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-12)",
        padding: "var(--space-10) var(--space-12)",
        borderBottom: last ? "none" : "var(--rule) solid var(--separator)",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: "var(--fs-caption)", lineHeight: "13px", color: "var(--text-secondary)", marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{withRowLabel(children, label)}</div>
    </div>
  );
}

/**
 * The row's visible label is not a <label> element (clicking it must not
 * operate the control), so pass it to a single unnamed field as its name.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withRowLabel(children: React.ReactNode, label: string): React.ReactNode {
  const items = Children.toArray(children);
  if (items.length !== 1 || !isValidElement<Record<string, unknown>>(items[0])) return children;
  const el = items[0];
  if (el.type === Toggle) return el.props.label ? el : cloneElement(el, { label });
  const labelable = typeof el.type === "string"
    ? ["input", "select", "textarea"].includes(el.type)
    : Boolean((el.type as { labelable?: boolean }).labelable);
  if (!labelable || el.props["aria-label"] || el.props["aria-labelledby"]) return el;
  return cloneElement(el, { "aria-label": label });
}

/* ── SectionHeader ── */

/** Sentence-case section label in text-secondary (`section` type style). */
export function SectionHeader({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: "var(--fs-control)",
        lineHeight: "14px",
        fontWeight: 600,
        color: color || "var(--text-secondary)",
        marginBottom: "var(--space-8)",
        marginTop: "var(--space-12)",
      }}
    >
      {children}
    </div>
  );
}

/* ── ActionButton ── */

export function ActionButton({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  variant?: "primary" | "danger" | "default" | "ghost";
  disabled?: boolean;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Button
      variant={variant === "default" ? "secondary" : variant}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={style}
    >
      {children}
    </Button>
  );
}

/* ── Badge ── */

export function Badge({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px var(--space-6)",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--fs-badge)",
        lineHeight: "12px",
        fontWeight: 600,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color: color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/* ── Pill ── */

export function Pill({
  active,
  children,
  onClick,
  title,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  const pill = (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={active ? "ui-pill is-active" : "ui-pill"}
    >
      {children}
    </button>
  );
  return title ? <Tooltip content={title}>{pill}</Tooltip> : pill;
}

/* ── Toggle ── */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when no visible label is associated. */
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 32,
        height: 18,
        flexShrink: 0,
        borderRadius: "var(--radius-full)",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? "var(--opacity-disabled)" : 1,
        transition: "background-color var(--dur-base)",
        backgroundColor: checked ? "var(--accent-primary)" : "var(--fill-strong)",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "var(--on-accent)",
          transition: "transform var(--dur-base) var(--ease-out)",
          transform: checked ? "translateX(17px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

/* ── EmptyState ── */

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "var(--space-24) var(--space-16)",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "var(--fs-control)",
      }}
    >
      {children}
    </div>
  );
}
