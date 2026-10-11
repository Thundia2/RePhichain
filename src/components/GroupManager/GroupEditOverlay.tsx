// ============================================================
// Group Edit Overlay — Floating toolbar shown during group edit mode
//
// Positioned at the top of the canvas, shows:
//   - Group name + color dot
//   - Dim others / Hide others / Simplified canvas toggles (pills)
//   - "Exit group" button
// ============================================================

import { LogOut } from "lucide-react";
import { useGroupStore } from "../../stores/groupStore";
import { Pill } from "../common/UIKit";
import { Button } from "../common/Button";

const DIVIDER_STYLE: React.CSSProperties = {
  width: "var(--rule)",
  height: 16,
  background: "var(--border-color)",
  flexShrink: 0,
};

export function GroupEditOverlay() {
  const activeGroup = useGroupStore((s) => s.getActiveGroup());
  const exitGroupEditMode = useGroupStore((s) => s.exitGroupEditMode);
  const groupEditMode = useGroupStore((s) => s.groupEditMode);
  const setGroupEditSettings = useGroupStore((s) => s.setGroupEditSettings);

  if (!activeGroup) return null;

  return (
    <div
      role="toolbar"
      aria-label="Group edit mode"
      style={{
        position: "absolute",
        top: "var(--space-6)",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        padding: "var(--space-4) var(--space-6) var(--space-4) var(--space-12)",
        background: "var(--bg-tertiary)",
        border: "var(--rule) solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        zIndex: "var(--z-sticky)",
        fontSize: "var(--fs-control)",
        boxShadow: "var(--shadow-popover)",
      }}
    >
      {/* Color dot + group name */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <div
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-full)",
            background: activeGroup.color,
            flexShrink: 0,
          }}
        />
        <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "var(--fs-control)" }}>
          {activeGroup.name}
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>
          ({activeGroup.type === "line"
            ? `${activeGroup.lines.length} lines`
            : `${activeGroup.notes.length} notes`})
        </span>
      </div>

      <div style={DIVIDER_STYLE} />

      {/* Toggles */}
      <Pill
        active={groupEditMode.dimOthers}
        title="Dim lines outside the group"
        onClick={() => setGroupEditSettings({ dimOthers: !groupEditMode.dimOthers })}
      >
        Dim
      </Pill>
      <Pill
        active={groupEditMode.hideOthers}
        title="Hide lines outside the group"
        onClick={() => setGroupEditSettings({ hideOthers: !groupEditMode.hideOthers })}
      >
        Hide
      </Pill>
      <Pill
        active={groupEditMode.simplifiedCanvas}
        title="Simplified canvas"
        onClick={() => setGroupEditSettings({ simplifiedCanvas: !groupEditMode.simplifiedCanvas })}
      >
        Simple
      </Pill>

      <div style={DIVIDER_STYLE} />

      {/* Exit button */}
      <Button variant="primary" size="sm" icon={LogOut} onClick={exitGroupEditMode}>
        Exit group
      </Button>
    </div>
  );
}
