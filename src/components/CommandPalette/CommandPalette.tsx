// ============================================================
// Command Palette — Quick-access search for actions and presets
//
// Ctrl+K opens a fuzzy-search overlay listing all menu actions,
// built-in event presets, and panel toggles. Results are scored
// by match quality and grouped by source (Actions, Presets).
// Selecting a result executes its action and closes the palette.
//
// Look: a popover-style palette (bg-tertiary, radius-xl,
// shadow-popover) over the --overlay scrim at --z-modal. Rows are
// menu items; the highlighted row uses accent-selected and
// shortcuts render as Kbd chips.
// ============================================================

import { useState, useRef, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { useMenus } from "../../hooks/useMenus";
import type { Menu } from "../../hooks/useMenus";
import { BUILTIN_PRESETS } from "../../presets/builtinPresets";
import { applyPresetAtPlayhead } from "../../utils/applyPreset";
import { getSelectedLineIndex } from "../../stores/selection";
import { useFavoritesStore } from "../../stores/favoritesStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { PanelId } from "../../types/editor";
import { Icon } from "../common/Icon";
import { Kbd } from "../common/Kbd";

interface CommandItem {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
}

function flattenMenus(menus: Menu[]): CommandItem[] {
  const items: CommandItem[] = [];
  for (const menu of menus) {
    for (const item of menu.items) {
      if (item.separator) continue;
      items.push({
        id: `${menu.label.toLowerCase()}:${item.label.toLowerCase().replace(/\s+/g, "-")}`,
        label: item.label,
        section: menu.label,
        shortcut: item.shortcut,
        action: item.action,
        disabled: item.disabled,
      });
    }
  }
  return items;
}

function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.section.toLowerCase().includes(q),
  );
}

function groupBySection(commands: CommandItem[]): [string, CommandItem[]][] {
  const map = new Map<string, CommandItem[]>();
  for (const cmd of commands) {
    const group = map.get(cmd.section) ?? [];
    group.push(cmd);
    map.set(cmd.section, group);
  }
  return Array.from(map.entries());
}

export function CommandPalette({
  open,
  onClose,
  onTogglePanel,
  onResetLayout,
  onNewChart,
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
  onShowOnsetCalibration,
}: {
  open: boolean;
  onClose: () => void;
  onTogglePanel?: (id: PanelId) => void;
  onResetLayout?: () => void;
  onNewChart?: () => void;
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
  onShowOnsetCalibration?: () => void;
}) {
  const menus = useMenus(onTogglePanel, onResetLayout, onNewChart, onShowParametric, onShowBatchLine, onShowLyricsSync, onShowOnDemandPanel, onShowPasteSpecial, onShowGoToBeat, onShowExportDiff, onShowSelectiveExport, onShowSpinGenerator, onShowShakeGenerator, undefined, onShowOnsetCalibration);
  const customPresets = useSettingsStore((s) => s.customPresets);
  const presetCommands = useMemo((): CommandItem[] => {
    return [...customPresets, ...BUILTIN_PRESETS].map((preset) => ({
      id: `preset:${preset.id}`,
      label: preset.name,
      section: "Event presets",
      shortcut: undefined,
      action: () => {
        const lineIndex = getSelectedLineIndex();
        if (lineIndex === null) return;
        applyPresetAtPlayhead(lineIndex, preset);
      },
      disabled: getSelectedLineIndex() === null,
    }));
  }, [customPresets]);
  const favoritesCommands = useMemo((): CommandItem[] => [
    {
      id: "favorites:configure",
      label: "Configure favorites…",
      section: "Favorites",
      action: () => useFavoritesStore.getState().openWizard(),
    },
  ], []);
  const allCommands = useMemo(() => [...flattenMenus(menus), ...presetCommands, ...favoritesCommands], [menus, presetCommands, favoritesCommands]);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterCommands(allCommands, query), [allCommands, query]);
  const grouped = useMemo(() => groupBySection(filtered), [filtered]);

  // Flat list for keyboard navigation
  const flatFiltered = useMemo(() => {
    const flat: CommandItem[] = [];
    for (const [, items] of grouped) {
      flat.push(...items);
    }
    return flat;
  }, [grouped]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus input after animation frame
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Clamp selectedIndex when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = () => {
    const item = flatFiltered[selectedIndex];
    if (item && !item.disabled && item.action) {
      item.action();
      onClose();
    }
  };

  /** Next enabled command from `from` in direction `dir` (wraps; stays put if none). */
  const stepEnabled = (from: number, dir: 1 | -1) => {
    const n = flatFiltered.length;
    for (let k = 1; k <= n; k++) {
      const i = (((from + dir * k) % n) + n) % n;
      if (!flatFiltered[i].disabled) return i;
    }
    return from;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => stepEnabled(prev, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => stepEnabled(prev, -1));
        break;
      case "Enter":
        e.preventDefault();
        executeSelected();
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{
        zIndex: "var(--z-modal)",
        backgroundColor: "var(--overlay)",
        paddingTop: "15vh",
        animation: "ui-fade-in var(--dur-fast) var(--ease-out)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 var(--space-16)",
          backgroundColor: "var(--bg-tertiary)",
          border: "var(--rule) solid var(--border-color)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-popover)",
          overflow: "hidden",
          animation: "ui-dialog-in var(--dur-fast) var(--ease-out)",
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center"
          style={{
            gap: "var(--space-8)",
            padding: "var(--space-8) var(--space-12)",
            borderBottom: "var(--rule) solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <Icon icon={Search} size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            aria-label="Search commands"
            aria-controls="command-palette-list"
            aria-activedescendant={flatFiltered[selectedIndex] ? `cmd-${flatFiltered[selectedIndex].id}` : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "var(--space-6) 0",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--text-primary)",
              fontSize: "var(--fs-headline)",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          style={{ padding: "var(--space-4)", maxHeight: 320, overflowY: "auto" }}
        >
          {flatFiltered.length === 0 && (
            <div style={{ padding: "var(--space-16) var(--space-10)", textAlign: "center", color: "var(--text-secondary)", fontSize: "var(--fs-body)" }}>
              No results found
            </div>
          )}
          {grouped.map(([section, items]) => (
            <div key={section} role="group" aria-label={section}>
              <div
                style={{
                  padding: "var(--space-6) var(--space-10) var(--space-4)",
                  fontSize: "var(--fs-caption)",
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                }}
              >
                {section}
              </div>
              {items.map((item) => {
                const thisIndex = flatIndex++;
                const isSelected = thisIndex === selectedIndex;
                return (
                  <button
                    key={item.id}
                    id={`cmd-${item.id}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isSelected}
                    aria-disabled={item.disabled || undefined}
                    data-selected={isSelected}
                    className="ui-menu-item"
                    style={{
                      justifyContent: "space-between",
                      cursor: item.disabled ? "default" : "pointer",
                      opacity: item.disabled ? "var(--opacity-disabled)" : undefined,
                      ...(isSelected ? { backgroundColor: "var(--accent-selected)" } : {}),
                    }}
                    // Hover moves the keyboard highlight (state, not styling);
                    // disabled commands can't be highlighted.
                    onMouseEnter={() => { if (!item.disabled) setSelectedIndex(thisIndex); }}
                    onClick={() => {
                      if (!item.disabled && item.action) {
                        item.action();
                        onClose();
                      }
                    }}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <Kbd style={{ marginLeft: "auto", flexShrink: 0 }}>{item.shortcut}</Kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
