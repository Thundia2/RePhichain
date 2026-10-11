// Shared ActionButton — full-width row button with icon and label.
// Verbs first; a label that opens a dialog ends with "…". An optional
// shortcut shows as a chip at the row's end.

import type { LucideIcon } from "lucide-react";
import { Icon } from "../../common/Icon";
import { ShortcutKbd } from "../../common/Kbd";
import { Tooltip } from "../../common/Tooltip";
import type { ShortcutRef } from "../../../hooks/useHotkeyLabel";

export function ActionButton({ icon, label, danger, onClick, disabled, title, shortcut }: {
  icon: LucideIcon; label: string; danger?: boolean; onClick?: () => void; disabled?: boolean; title?: string;
  /** Fixed key text, or `{ action }` for a rebindable registry shortcut. */
  shortcut?: ShortcutRef;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ui-btn ui-btn--ghost ui-btn--row"
      style={danger ? { color: "var(--error)" } : undefined}
    >
      <Icon icon={icon} />
      {label}
      {shortcut && <ShortcutKbd value={shortcut} style={{ marginLeft: "auto" }} />}
    </button>
  );
  return title ? <Tooltip content={title}>{button}</Tooltip> : button;
}
