// ============================================================
// Line Context Menu — Right-click menu for LineList items
//
// Actions: Open event editor, Duplicate, Delete, Set category.
// A ui-popover of ui-menu-items; hover comes from CSS.
// ============================================================

import { useState } from "react";
import { SquarePen, Copy, Trash2, Tag, ChevronRight, ChevronDown, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useTabStore } from "../../stores/tabStore";
import { Icon } from "../common/Icon";
import {
  LINE_CATEGORY_COLORS,
  LINE_CATEGORY_LABELS,
} from "./lineCategories";

interface LineContextMenuProps {
  x: number;
  y: number;
  lineIndex: number;
  onClose: () => void;
}

export function LineContextMenu({
  x,
  y,
  lineIndex,
  onClose,
}: LineContextMenuProps) {
  const line = useChartStore((s) => s.chart.lines[lineIndex]);
  const editLine = useChartStore((s) => s.editLine);
  const removeLine = useChartStore((s) => s.removeLine);
  const duplicateLine = useChartStore((s) => s.duplicateLine);
  const openLineEventEditor = useTabStore((s) => s.openLineEventEditor);
  const [showCategorySubmenu, setShowCategorySubmenu] = useState(false);

  if (!line) return null;

  // Clamp menu position to viewport
  const menuWidth = 200;
  const menuHeight = 260;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: "calc(var(--z-dropdown) - 1)" }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      {/* Menu */}
      <div
        role="menu"
        aria-label="Line actions"
        className="ui-popover"
        style={{
          position: "fixed",
          left: clampedX,
          top: clampedY,
          zIndex: "var(--z-dropdown)",
          minWidth: menuWidth,
        }}
      >
        <MenuItem
          icon={SquarePen}
          label="Open event editor"
          onClick={() => {
            openLineEventEditor(lineIndex, line.name);
            onClose();
          }}
        />
        <MenuItem
          icon={Copy}
          label="Duplicate line"
          onClick={() => {
            duplicateLine(lineIndex);
            onClose();
          }}
        />
        <MenuItem
          icon={Trash2}
          label="Delete line"
          onClick={() => {
            removeLine(lineIndex);
            onClose();
          }}
          danger
        />
        <div className="ui-menu-separator" role="separator" />
        <MenuItem
          icon={Tag}
          label="Category"
          trailing={<Icon icon={showCategorySubmenu ? ChevronDown : ChevronRight} size={12} style={{ color: "var(--text-secondary)" }} />}
          ariaExpanded={showCategorySubmenu}
          onClick={() => setShowCategorySubmenu(!showCategorySubmenu)}
        />
        {showCategorySubmenu && (
          <div style={{ paddingLeft: "var(--space-8)" }}>
            {(["gameplay", "visual", "text", "helper"] as const).map((cat) => (
              <MenuItem
                key={cat}
                label={LINE_CATEGORY_LABELS[cat]}
                leading={
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "var(--radius-full)",
                      backgroundColor: LINE_CATEGORY_COLORS[cat],
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                }
                active={line._category === cat}
                onClick={() => {
                  editLine(lineIndex, { _category: cat });
                  onClose();
                }}
              />
            ))}
            <div className="ui-menu-separator" role="separator" />
            <MenuItem
              label="None"
              active={!line._category}
              onClick={() => {
                editLine(lineIndex, { _category: undefined });
                onClose();
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  active,
  icon,
  leading,
  trailing,
  ariaExpanded,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  icon?: LucideIcon;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  ariaExpanded?: boolean;
}) {
  const isChoice = active !== undefined;
  return (
    <button
      type="button"
      role={isChoice ? "menuitemradio" : "menuitem"}
      aria-checked={isChoice ? active : undefined}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className={danger ? "ui-menu-item ui-menu-item--danger" : "ui-menu-item"}
      style={active ? { color: "var(--accent-primary)" } : undefined}
    >
      {icon && <Icon icon={icon} size={14} style={danger || active ? undefined : { color: "var(--text-secondary)" }} />}
      {leading}
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {active && <Icon icon={Check} size={12} />}
      {trailing}
    </button>
  );
}
