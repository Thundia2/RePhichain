// ============================================================
// Icon — Lucide line icon at the design system's 1.5px stroke.
//
// Sizes: 16 in the tool rail / toolbars, 14 in rows, buttons and
// headers (default), 12 in compact controls. Colour comes from
// currentColor, so the parent sets text-secondary / accent.
//
//   import { Plus } from "lucide-react";
//   <Icon icon={Plus} />
// ============================================================

import type { LucideIcon, LucideProps } from "lucide-react";

export type IconSize = 12 | 14 | 16 | 20;

export function Icon({
  icon: Glyph,
  size = 14,
  style,
  ...rest
}: { icon: LucideIcon; size?: IconSize } & Omit<LucideProps, "ref" | "size">) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.5}
      absoluteStrokeWidth
      aria-hidden="true"
      focusable={false}
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
