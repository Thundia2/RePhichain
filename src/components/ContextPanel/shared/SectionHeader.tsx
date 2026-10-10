// Shared SectionHeader — sentence-case section label with optional count
// badge and add button.

import { Plus } from "lucide-react";
import { IconButton } from "../../common/IconButton";

export function SectionHeader({ label, count, onAdd, addLabel = "Add" }: {
  label: string; count?: number; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "var(--control-md)",
        margin: "var(--space-12) 0 var(--space-6)",
      }}
    >
      <span style={{ fontSize: "var(--fs-control)", lineHeight: "14px", fontWeight: 600, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        {label}
        {count !== undefined && (
          <span
            style={{
              fontSize: "var(--fs-badge)",
              lineHeight: "12px",
              padding: "1px var(--space-6)",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-active)",
              color: "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            {count}
          </span>
        )}
      </span>
      {onAdd && <IconButton icon={Plus} label={addLabel} size="md" onClick={onAdd} />}
    </div>
  );
}
