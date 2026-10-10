// Shared ActionButton — full-width row button with icon and label.
// Verbs first; a label that opens a dialog ends with "…".

import type { LucideIcon } from "lucide-react";
import { Icon } from "../../common/Icon";

export function ActionButton({ icon, label, danger, onClick, disabled, title }: {
  icon: LucideIcon; label: string; danger?: boolean; onClick?: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="ui-btn ui-btn--ghost ui-btn--row"
      style={danger ? { color: "var(--error)" } : undefined}
    >
      <Icon icon={icon} />
      {label}
    </button>
  );
}
