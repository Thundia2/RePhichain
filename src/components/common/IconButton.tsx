// ============================================================
// IconButton — icon-only control. Its name and shortcut live in a
// tooltip (and aria-label), never printed under the icon. A disabled
// IconButton uses aria-disabled, so it stays hoverable/focusable and its
// tooltip still says what it is; clicks are ignored.
//
//   <IconButton icon={Plus} label="Add new line" shortcut="Ctrl+L" onClick={…} />
//   <IconButton label="Tap" shortcut="Q" active={…}><NoteGlyph kind="tap" /></IconButton>
// ============================================================

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon, type IconSize } from "./Icon";
import { Tooltip, type TooltipPosition } from "./Tooltip";

type Size = "sm" | "md" | "lg";

const ICON_SIZE: Record<Size, IconSize> = { sm: 12, md: 14, lg: 16 };

export function IconButton({
  icon,
  children,
  label,
  shortcut,
  size = "lg",
  iconSize,
  active,
  danger,
  disabled,
  tooltipPosition = "top",
  onClick,
  className,
  style,
  ...rest
}: {
  icon?: LucideIcon;
  children?: React.ReactNode;
  /** Accessible name; also the tooltip text. */
  label: string;
  shortcut?: string;
  size?: Size;
  iconSize?: IconSize;
  /** Toggle state. Leave undefined for a plain action button. */
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  tooltipPosition?: TooltipPosition;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children" | "className" | "style">) {
  const classes = [
    "ui-icon-btn",
    size !== "lg" ? `ui-icon-btn--${size}` : "",
    danger ? "ui-icon-btn--danger" : "",
    active ? "is-active" : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <Tooltip content={label} shortcut={shortcut} position={tooltipPosition}>
      <button
        type="button"
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={active === undefined ? undefined : active}
        aria-disabled={disabled || undefined}
        onClick={disabled ? (e) => e.preventDefault() : onClick}
        className={classes}
        style={style}
        {...rest}
      >
        {icon ? <Icon icon={icon} size={iconSize ?? ICON_SIZE[size]} /> : children}
      </button>
    </Tooltip>
  );
}
