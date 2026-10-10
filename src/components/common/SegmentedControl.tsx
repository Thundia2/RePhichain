// ============================================================
// SegmentedControl — a row of mutually exclusive options on a
// bg-active track. tone="neutral" lifts the selected option to
// bg-secondary (tabs, views); tone="accent" fills it with the
// accent (settings values, speed).
// ============================================================

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  /** Tooltip / accessible description. */
  title?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  tone = "neutral",
  size = "md",
  block,
  label,
  role = "radiogroup",
  style,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  tone?: "neutral" | "accent";
  size?: "sm" | "md";
  /** Stretch to the container width, options share it equally. */
  block?: boolean;
  /** Accessible name for the group. */
  label?: string;
  /** "tablist" when the control switches panels. */
  role?: "radiogroup" | "tablist";
  style?: React.CSSProperties;
}) {
  const classes = [
    "ui-segmented",
    tone === "accent" ? "ui-segmented--accent" : "",
    size === "sm" ? "ui-segmented--sm" : "",
    block ? "ui-segmented--block" : "",
  ].filter(Boolean).join(" ");
  const itemRole = role === "tablist" ? "tab" : "radio";

  return (
    <div role={role} aria-label={label} className={classes} style={style}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const button = (
          <button
            key={String(opt.value)}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? selected : undefined}
            aria-selected={itemRole === "tab" ? selected : undefined}
            aria-label={opt.title && !opt.label ? opt.title : undefined}
            disabled={opt.disabled}
            className={selected ? "ui-segmented__opt is-selected" : "ui-segmented__opt"}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <Icon icon={opt.icon} size={12} />}
            {opt.label}
          </button>
        );
        return opt.title ? (
          <Tooltip key={String(opt.value)} content={opt.title}>{button}</Tooltip>
        ) : button;
      })}
    </div>
  );
}
