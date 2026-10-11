// ============================================================
// Line Drawer — Slide-out overlay for line management
//
// 210px wide panel that slides in from the left.
// Shows all lines with visibility/lock toggles.
// Supports: click to select, double-click rename, right-click
// context menu (Rename, Duplicate, Delete, Set parent, Set group),
// hierarchy indentation via father_index. Rows hover via
// ui-hover; the context menu is a ui-popover; value prompts use
// the shared showPrompt dialog.
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Eye, EyeOff, Lock, LockOpen, TextCursorInput, Copy, Trash2, CornerLeftUp, Group } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSelectedLineIndex, selectLineByIndex } from "../../stores/selection";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { showPrompt } from "../common/PromptDialog";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";

// ---- Context menu state ----
interface ContextMenu {
  x: number;
  y: number;
  lineIndex: number;
  /** Document the menu opened in (the main window or a pop-out). */
  doc: Document;
}

interface MenuEntry {
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  separatorBefore?: boolean;
  action: () => void;
}

// ---- Compute indentation depth from father_index chain ----
function getDepth(lines: { father_index?: number }[], index: number): number {
  let depth = 0;
  let current = lines[index]?.father_index;
  const visited = new Set<number>();
  while (current != null && current >= 0 && current < lines.length && depth < 5) {
    if (visited.has(current)) break; // prevent cycles
    visited.add(current);
    depth++;
    current = lines[current]?.father_index;
  }
  return depth;
}

export function LineDrawer() {
  const lines = useChartStore((s) => s.chart.lines);
  const selectedLineIndex = useSelectedLineIndex();
  const drawerOpen = useEditorStore((s) => s.lineDrawerOpen);
  const toggleVisibility = useEditorStore((s) => s.toggleLineVisibility);
  const toggleLocked = useEditorStore((s) => s.toggleLineLocked);
  const lineVisibility = useEditorStore((s) => s.lineVisibility);
  const lineLocked = useEditorStore((s) => s.lineLocked);
  const addLine = useChartStore((s) => s.addLine);
  const removeLine = useChartStore((s) => s.removeLine);
  const duplicateLine = useChartStore((s) => s.duplicateLine);
  const editLine = useChartStore((s) => s.editLine);

  // ---- Inline rename state ----
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ---- Context menu state ----
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus rename input when activated
  useEffect(() => {
    if (renamingIndex !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingIndex]);

  // Context menu: outside press / Escape close it, arrows move between items
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useMenuKeyboard(contextMenu !== null, closeContextMenu, menuRef, { focusFirst: true, closeOnOutsidePress: true });

  const commitRename = useCallback(() => {
    if (renamingIndex !== null) {
      editLine(renamingIndex, { name: renameValue });
      setRenamingIndex(null);
    }
  }, [renamingIndex, renameValue, editLine]);

  const handleContextMenu = useCallback((e: React.MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: i, doc: e.currentTarget.ownerDocument });
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    const line = lines[i];
    setRenameValue(line?.name || `Line ${i}`);
    setRenamingIndex(i);
  }, [lines]);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 210,
        zIndex: "var(--z-raised)",
        background: "var(--bg-secondary)",
        borderRight: "var(--rule) solid var(--border-color)",
        transform: drawerOpen ? "translateX(0)" : "translateX(-220px)",
        transition: "transform var(--dur-base) var(--ease-out)",
        display: "flex",
        flexDirection: "column",
        fontSize: "var(--fs-control)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--space-6) var(--space-6) var(--space-6) var(--space-10)",
          borderBottom: "var(--rule) solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: "var(--fs-control)" }}>
          Lines
        </span>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => addLine()}>
          Add
        </Button>
      </div>

      {/* Line list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4)" }}>
        {lines.map((line, i) => {
          const isSelected = selectedLineIndex === i;
          const isVisible = lineVisibility[i] !== false;
          const isLocked = lineLocked[i] === true;
          const depth = getDepth(lines, i);

          return (
            <div
              key={i}
              onClick={() => selectLineByIndex(i)}
              onContextMenu={(e) => handleContextMenu(e, i)}
              onDoubleClick={(e) => handleDoubleClick(e, i)}
              className="ui-hover"
              aria-current={isSelected ? "true" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "var(--space-2) var(--space-6) var(--space-2) var(--space-2)",
                paddingLeft: 2 + depth * 14,
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                marginBottom: 1,
                background: isSelected ? "var(--accent-selected)" : undefined,
              }}
            >
              {/* Visibility toggle */}
              <IconButton
                icon={isVisible ? Eye : EyeOff}
                label={isVisible ? "Hide line" : "Show line"}
                size="sm"
                tooltipPosition="right"
                style={{ color: isVisible ? "var(--text-secondary)" : "var(--text-muted)" }}
                onClick={(e) => { e.stopPropagation(); toggleVisibility(i); }}
              />

              {/* Lock toggle */}
              <IconButton
                icon={isLocked ? Lock : LockOpen}
                label={isLocked ? "Unlock line" : "Lock line"}
                size="sm"
                tooltipPosition="right"
                style={{ color: isLocked ? "var(--text-primary)" : "var(--text-muted)" }}
                onClick={(e) => { e.stopPropagation(); toggleLocked(i); }}
              />

              {/* Name (or inline rename input) */}
              {renamingIndex === i ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingIndex(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Line name"
                  style={{
                    flex: 1,
                    height: "var(--control-sm)",
                    background: "var(--bg-tertiary)",
                    border: "var(--hairline) solid var(--accent-primary)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0 var(--space-4)",
                    color: "var(--text-primary)",
                    fontSize: "var(--fs-control)",
                    fontFamily: "inherit",
                    minWidth: 0,
                  }}
                />
              ) : (
                <span
                  style={{
                    flex: 1,
                    marginLeft: "var(--space-2)",
                    color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {line.name || `Line ${i}`}
                </span>
              )}

              {/* Note count */}
              <Tooltip content={`${line.notes.length} ${line.notes.length === 1 ? "note" : "notes"}`} position="right">
                <span
                  aria-label={`${line.notes.length} ${line.notes.length === 1 ? "note" : "notes"}`}
                  style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", flexShrink: 0 }}
                >
                  {line.notes.length}
                </span>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {/* Context menu — portalled to the body: the drawer's slide transform would
          otherwise make position: fixed relative to the drawer, not the window. */}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Line actions"
          className="ui-popover"
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: "var(--z-dropdown)",
            minWidth: 160,
          }}
        >
          {([
            { label: "Rename", icon: TextCursorInput, action: () => {
              const line = lines[contextMenu.lineIndex];
              setRenameValue(line?.name || `Line ${contextMenu.lineIndex}`);
              setRenamingIndex(contextMenu.lineIndex);
              setContextMenu(null);
            }},
            { label: "Duplicate", icon: Copy, action: () => {
              duplicateLine(contextMenu.lineIndex);
              setContextMenu(null);
            }},
            { label: "Delete", icon: Trash2, danger: true, action: () => {
              removeLine(contextMenu.lineIndex);
              setContextMenu(null);
            }},
            { label: "Set parent…", icon: CornerLeftUp, separatorBefore: true, action: async () => {
              const li = contextMenu.lineIndex;
              setContextMenu(null);
              const val = await showPrompt({
                title: "Set parent line",
                label: "Parent line index (-1 for none)",
                defaultValue: String(lines[li]?.father_index ?? -1),
                confirmLabel: "Set parent",
              });
              if (val === null) return;
              const idx = parseInt(val);
              if (!isNaN(idx)) editLine(li, { father_index: idx === -1 ? undefined : idx });
            }},
            { label: "Set group…", icon: Group, action: async () => {
              const li = contextMenu.lineIndex;
              setContextMenu(null);
              const val = await showPrompt({
                title: "Set group",
                label: "Group number",
                defaultValue: String(lines[li]?.group ?? 0),
                confirmLabel: "Set group",
              });
              if (val === null) return;
              const num = parseInt(val);
              editLine(li, { group: isNaN(num) ? undefined : num === 0 ? undefined : num });
            }},
          ] as MenuEntry[]).map((item) => (
            <div key={item.label} style={{ display: "contents" }}>
              {item.separatorBefore && <div className="ui-menu-separator" role="separator" />}
              <button
                type="button"
                role="menuitem"
                onClick={item.action}
                className={item.danger ? "ui-menu-item ui-menu-item--danger" : "ui-menu-item"}
              >
                <Icon icon={item.icon} size={14} style={item.danger ? undefined : { color: "var(--text-secondary)" }} />
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        contextMenu.doc.body,
      )}
    </div>
  );
}
