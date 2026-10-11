// ============================================================
// GroupRow — Individual group list item
//
// Displays group color, type badge, name (editable inline),
// member count, lock status, and action buttons. Hover comes
// from ui-hover; the selected row is accent-selected.
// Extracted from GroupManager.tsx.
// ============================================================

import { Lock, LockOpen, Trash2, PenLine } from "lucide-react";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import { Tooltip } from "../common/Tooltip";
import type { EditorGroup } from "../../types/group";

export interface GroupRowProps {
  group: EditorGroup;
  isSelected: boolean;
  isActive: boolean;
  editingNameId: string | null;
  editingName: string;
  onSelect: () => void;
  onEnterEdit: () => void;
  onExitEdit: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onEditingNameChange: (name: string) => void;
}

export function GroupRow({
  group, isSelected, isActive,
  editingNameId, editingName,
  onSelect, onEnterEdit, onExitEdit,
  onDelete, onToggleLock,
  onStartRename, onCommitRename, onCancelRename, onEditingNameChange,
}: GroupRowProps) {
  const isEditing = editingNameId === group.id;
  const memberCount = group.type === "line" ? group.lines.length : group.notes.length;

  return (
    <div
      className="ui-hover"
      style={{
        display: "flex", alignItems: "center", gap: "var(--space-6)",
        minHeight: "var(--control-lg)",
        padding: "var(--space-2) var(--space-6)", borderRadius: "var(--radius-md)",
        background: isSelected
          ? "var(--accent-selected)"
          : isActive
            ? "color-mix(in srgb, var(--success) 8%, transparent)"
            : undefined,
        color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
        cursor: "pointer", marginBottom: "var(--space-2)",
      }}
      onClick={onSelect}
      onDoubleClick={isActive ? onExitEdit : onEnterEdit}
    >
      {/* Color dot */}
      <div aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: group.color, flexShrink: 0 }} />

      {/* Type badge */}
      <span style={{
        fontSize: "var(--fs-badge)", lineHeight: "12px", fontWeight: 600,
        padding: "1px var(--space-6)", borderRadius: "var(--radius-full)",
        background: group.type === "line" ? "var(--accent-tint)" : "var(--fill-strong)",
        color: group.type === "line" ? "var(--accent-primary)" : "var(--text-secondary)",
        flexShrink: 0,
      }}>
        {group.type === "line" ? "Line" : "Note"}
      </span>

      {/* Name */}
      {isEditing ? (
        <input
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          aria-label="Group name"
          style={{
            flex: 1, fontSize: "var(--fs-control)", height: "var(--control-sm)",
            padding: "0 var(--space-4)",
            background: "var(--bg-tertiary)", color: "var(--text-primary)",
            border: "var(--hairline) solid var(--accent-primary)", borderRadius: "var(--radius-sm)",
            fontFamily: "inherit", minWidth: 0,
          }}
        />
      ) : (
        <span
          style={{ flex: 1, fontSize: "var(--fs-control)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
        >
          {group.name}
        </span>
      )}

      {/* Member count */}
      <span
        aria-label={`${memberCount} members`}
        style={{ fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", flexShrink: 0 }}
      >
        {memberCount}
      </span>

      {/* Lock indicator */}
      {group.locked && (
        <Tooltip content="Locked">
          <span role="img" aria-label="Locked" style={{ display: "inline-flex", color: "var(--text-secondary)" }}>
            <Icon icon={Lock} size={12} />
          </span>
        </Tooltip>
      )}

      {/* Active indicator */}
      {isActive && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--fs-caption)", color: "var(--success)", fontWeight: 600, flexShrink: 0 }}>
          <Icon icon={PenLine} size={12} />
          Editing
        </span>
      )}

      {/* Actions */}
      <IconButton
        icon={group.locked ? LockOpen : Lock}
        label={group.locked ? "Unlock group" : "Lock group"}
        size="sm"
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
      />
      <IconButton
        icon={Trash2}
        label="Delete group"
        size="sm"
        danger
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      />
    </div>
  );
}
