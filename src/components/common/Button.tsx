// ============================================================
// Button — text button in the design system's four variants.
// primary = the one main action on a surface; secondary = filled
// bg-active (default); ghost = transparent; danger = destructive.
// `title` renders as the shared Tooltip, not the native one.
// ============================================================

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  children,
  type = "button",
  title,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = [
    "ui-btn",
    variant !== "secondary" ? `ui-btn--${variant}` : "",
    size !== "md" ? `ui-btn--${size}` : "",
    block ? "ui-btn--block" : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  const button = (
    <button
      type={type}
      className={classes}
      // An icon-only button is named by its tooltip text.
      aria-label={rest["aria-label"] ?? (title && children == null ? title : undefined)}
      {...rest}
    >
      {icon && <Icon icon={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
  // `title` shows as the shared tooltip, not the browser's native one.
  return title ? <Tooltip content={title}>{button}</Tooltip> : button;
}
