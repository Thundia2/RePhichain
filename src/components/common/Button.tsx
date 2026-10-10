// ============================================================
// Button — text button in the design system's four variants.
// primary = the one main action on a surface; secondary = filled
// bg-active (default); ghost = transparent; danger = destructive.
// ============================================================

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  block,
  className,
  children,
  type = "button",
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
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <Icon icon={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}
