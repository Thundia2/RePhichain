// ============================================================
// Menu Bar — Top-level navigation menus
//
// Renders the horizontal menu bar (File, Edit, View, Panels,
// Help) using menu definitions from useMenus(). Handles open/
// close state, keyboard navigation, and click-outside dismiss.
// Passes dialog and panel toggle callbacks down to useMenus.
// ============================================================

import { useState, useRef, useEffect } from "react";
import { useChartStore } from "../../stores/chartStore";
import type { PanelId } from "../../types/editor";
import { useMenus } from "../../hooks/useMenus";
import type { Menu } from "../../hooks/useMenus";
import { Command, Hexagon, Settings } from "lucide-react";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import { Kbd } from "../common/Kbd";

export function MenuBar({
  onTogglePanel,
  onResetLayout,
  onNewChart,
  onOpenSettings,
  onOpenCommandPalette,
  onShowParametric,
  onShowBatchLine,
  onShowLyricsSync,
  onShowOnDemandPanel,
  onShowPasteSpecial,
  onShowGoToBeat,
  onShowExportDiff,
  onShowSelectiveExport,
  onShowSpinGenerator,
  onShowShakeGenerator,
  onShowNotePattern,
  onShowOnsetCalibration,
}: {
  onTogglePanel?: (id: PanelId) => void;
  onResetLayout?: () => void;
  onNewChart?: () => void;
  onOpenSettings?: () => void;
  onOpenCommandPalette?: () => void;
  onShowParametric?: () => void;
  onShowBatchLine?: () => void;
  onShowLyricsSync?: () => void;
  onShowOnDemandPanel?: (id: PanelId) => void;
  onShowPasteSpecial?: () => void;
  onShowGoToBeat?: () => void;
  onShowExportDiff?: () => void;
  onShowSelectiveExport?: () => void;
  onShowSpinGenerator?: () => void;
  onShowShakeGenerator?: () => void;
  onShowNotePattern?: () => void;
  onShowOnsetCalibration?: () => void;
}) {
  const MENUS = useMenus(onTogglePanel, onResetLayout, onNewChart, onShowParametric, onShowBatchLine, onShowLyricsSync, onShowOnDemandPanel, onShowPasteSpecial, onShowGoToBeat, onShowExportDiff, onShowSelectiveExport, onShowSpinGenerator, onShowShakeGenerator, onShowNotePattern, onShowOnsetCalibration);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const chartName = useChartStore((s) => s.meta.name);
  const isDirty = useChartStore((s) => s.isDirty);
  const isLoaded = useChartStore((s) => s.isLoaded);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={menuRef}
      className="flex items-center flex-shrink-0"
      style={{
        height: "var(--topbar-height)",
        gap: "var(--space-12)",
        padding: "0 var(--space-12)",
        backgroundColor: "var(--bg-primary)",
        borderBottom: "var(--rule) solid var(--border-color)",
      }}
    >
      {/* ── Left: Breadcrumb ── */}
      <div className="flex items-center" style={{ minWidth: 0, gap: "var(--space-6)" }}>
        <Icon icon={Hexagon} size={16} style={{ color: "var(--accent-primary)" }} />
        <span style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: isLoaded ? "var(--text-secondary)" : "var(--text-primary)" }}>PhiChain</span>
        {isLoaded && (
          <>
            <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>/</span>
            <span
              className="truncate"
              style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", maxWidth: 180 }}
            >
              {chartName || "Untitled"}
            </span>
            <span
              style={{
                fontSize: "var(--fs-badge)",
                lineHeight: "12px",
                fontWeight: 600,
                padding: "1px var(--space-6)",
                borderRadius: "var(--radius-full)",
                backgroundColor: isDirty ? "var(--unsaved-bg)" : "var(--bg-active)",
                color: isDirty ? "var(--unsaved)" : "var(--text-secondary)",
                whiteSpace: "nowrap",
              }}
            >
              {isDirty ? "unsaved" : "saved"}
            </span>
          </>
        )}
      </div>

      {/* ── Center: Menus ── */}
      <div role="menubar" aria-label="Main menu" className="flex-1 flex items-center justify-center" style={{ gap: "var(--space-2)" }}>
        {MENUS.map((menu, menuIndex) => (
          <MenuDropdown
            key={menu.label}
            menu={menu}
            isOpen={openMenu === menuIndex}
            onToggle={() => setOpenMenu(openMenu === menuIndex ? null : menuIndex)}
            onHoverEnter={() => {
              if (openMenu !== null) setOpenMenu(menuIndex);
            }}
            onClose={() => setOpenMenu(null)}
          />
        ))}
      </div>

      {/* ── Right: Command Palette + Settings ── */}
      <div className="flex items-center" style={{ gap: "var(--space-6)" }}>
        <button
          type="button"
          className="flex items-center ui-hover"
          style={{
            gap: "var(--space-6)",
            height: "var(--control-md)",
            padding: "0 var(--space-6) 0 var(--space-8)",
            backgroundColor: "var(--bg-active)",
            borderRadius: "var(--radius-lg)",
            border: "var(--hairline) solid var(--border-color)",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: "var(--fs-control)",
          }}
          onClick={() => { setOpenMenu(null); onOpenCommandPalette?.(); }}
        >
          <Icon icon={Command} size={12} />
          <span>Command palette</span>
          <Kbd style={{ background: "var(--bg-tertiary)" }}>Ctrl+K</Kbd>
        </button>
        <IconButton
          icon={Settings}
          label="Settings"
          tooltipPosition="bottom"
          onClick={() => { setOpenMenu(null); onOpenSettings?.(); }}
        />
      </div>
    </div>
  );
}

/* ── Menu Dropdown Sub-component ── */
function MenuDropdown({
  menu,
  isOpen,
  onToggle,
  onHoverEnter,
  onClose,
}: {
  menu: Menu;
  isOpen: boolean;
  onToggle: () => void;
  onHoverEnter: () => void;
  onClose: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Escape closes the open menu and returns focus to its trigger,
  // wherever focus is (a mouse-opened menu leaves it on the trigger or body).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  /** Move focus among the enabled items: +1/-1 steps, "first"/"last" jumps. */
  const focusItem = (to: 1 | -1 | "first" | "last") => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      to === "first" ? 0
      : to === "last" ? items.length - 1
      : i === -1 ? (to === 1 ? 0 : items.length - 1)
      : (i + to + items.length) % items.length;
    items[next].focus();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const to = ({ ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" } as const)[e.key as "ArrowDown"];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // keep arrow keys away from the editor's hotkeys
    focusItem(to);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) onToggle();
    const to = e.key === "ArrowDown" ? "first" : "last";
    requestAnimationFrame(() => focusItem(to));
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="ui-hover"
        style={{
          padding: "var(--space-4) var(--space-10)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--fs-body)",
          color: isOpen ? "var(--text-primary)" : "var(--text-secondary)",
          backgroundColor: isOpen ? "var(--bg-active)" : "transparent",
          cursor: "pointer",
          border: "none",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={onHoverEnter}
        onClick={onToggle}
        onKeyDown={onTriggerKeyDown}
      >
        {menu.label}
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="menu"
          aria-label={menu.label}
          onKeyDown={onListKeyDown}
          className="absolute top-full left-0 ui-popover"
          style={{
            zIndex: "var(--z-dropdown)",
            marginTop: "var(--space-2)",
            minWidth: 220,
            // Size to the longest label + shortcut; the trigger it is
            // positioned in is narrower than the menu.
            width: "max-content",
          }}
        >
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} role="separator" className="ui-menu-separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="ui-menu-item"
                style={{ justifyContent: "space-between" }}
                disabled={item.disabled}
                onClick={() => {
                  item.action?.();
                  onClose();
                }}
              >
                <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
                {item.shortcut && (
                  <span
                    style={{
                      marginLeft: "auto",
                      paddingLeft: "var(--space-16)",
                      color: "var(--text-secondary)",
                      fontSize: "var(--fs-caption)",
                      fontFamily: "var(--font-mono)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.shortcut}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
