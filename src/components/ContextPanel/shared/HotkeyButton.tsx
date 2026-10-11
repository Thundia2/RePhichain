// Shared HotkeyButton — icon-only action with its name and shortcut in the
// tooltip. Lay several out in a <ToolGroup>.

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { IconButton } from "../../common/IconButton";
import type { ShortcutRef } from "../../../hooks/useHotkeyLabel";

export function HotkeyButton({ icon, label, hotkey, active, style, onClick, disabled }: {
  icon: LucideIcon; label: string; hotkey?: ShortcutRef;
  active?: boolean; style?: React.CSSProperties; onClick?: () => void; disabled?: boolean;
}) {
  return (
    <IconButton
      icon={icon}
      label={label}
      shortcut={hotkey || undefined}
      active={active}
      disabled={disabled}
      style={style}
      onClick={onClick}
    />
  );
}
