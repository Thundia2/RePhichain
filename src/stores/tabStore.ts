// ============================================================
// Tab Store — Zustand
//
// Manages browser-like tabs: Home, Chart(s), Line Event Editor, Panels.
// Home tab is always present and not closable.
//
// Recent change: Added renamingTabId state + startRenameTab() /
// clearRenaming() for inline tab rename triggered from command
// palette (F2) or double-click. Also cleaned up per-line label
// to remove redundant "Unrolled:" prefix (badge now shows type).
//
// Usage:
//   const tabs = useTabStore(s => s.tabs);
//   const activeTabId = useTabStore(s => s.activeTabId);
// ============================================================

import { create } from "zustand";
import { useSettingsStore } from "./settingsStore";
import { useEditorStore } from "./editorStore";

export type TabType = "home" | "chart" | "line_event_editor" | "panel" | "unified_editor" | "unrolled_editor";

export interface Tab {
  id: string;
  type: TabType;
  label: string;
  closable: boolean;
  data?: Record<string, unknown>;
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string;

  /** Open or focus a tab. Creates if new, updates label/data if existing. */
  openTab: (tab: Tab) => void;
  /** Close a tab. Falls back to adjacent tab or Home if the closed tab was active. */
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabLabel: (tabId: string, label: string) => void;

  // Convenience — typed wrappers around openTab
  openChart: (chartId: string, label: string) => void;
  openLineEventEditor: (lineIndex: number, lineName: string) => void;
  openPanel: (panelId: string, label: string) => void;
  openUnifiedEditor: () => void;
  openUnrolledEditor: () => void;
  /** Open a per-line unrolled editor tab. Creates a tab locked to lineIndex. */
  openUnrolledLineEditor: (lineIndex: number, lineName: string, initialScrollBeat: number) => void;

  /** Get the tab ID that would be used for a given chartId under current settings */
  getChartTabId: (chartId: string) => string;

  // ---- Inline rename ----
  /** ID of the tab currently being renamed (null if none) */
  renamingTabId: string | null;
  /** Enter rename mode for a tab. Defaults to active tab. Only closable tabs allowed. */
  startRenameTab: (tabId?: string) => void;
  /** Exit rename mode without committing */
  clearRenaming: () => void;
}

const HOME_TAB: Tab = { id: "home", type: "home", label: "Home", closable: false };

export const useTabStore = create<TabState>()((set, get) => ({
  tabs: [HOME_TAB],
  activeTabId: "home",

  openTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);
    if (existing) {
      // Update label + data if they changed
      set({
        activeTabId: tab.id,
        tabs: tabs.map((t) =>
          t.id === tab.id ? { ...t, label: tab.label, data: tab.data ?? t.data } : t
        ),
      });
      return;
    }
    set({ tabs: [...tabs, tab], activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || !tab.closable) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      // Switch to the previous tab or home
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newActive = newTabs[Math.max(0, idx - 1)]?.id ?? "home";
      set({ tabs: newTabs, activeTabId: newActive });
    } else {
      set({ tabs: newTabs });
    }

    // Clean up per-line unrolled tab state when closed
    if (tab.id.startsWith("unrolled-line:") && tab.data?.lineIndex !== undefined) {
      const li = tab.data.lineIndex as number;
      useEditorStore.getState().clearLineTabScrollBeat(li);
      useEditorStore.getState().clearUnrolledFollowPlayback(String(li));
    }
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  updateTabLabel: (tabId, label) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
    }));
  },

  openChart: (chartId, label) => {
    const defaultView = useSettingsStore.getState().defaultEditorView;
    if (defaultView === "unified") {
      get().openTab({
        id: `unified:${chartId}`,
        type: "unified_editor",
        label: label || "Unified Editor",
        closable: true,
      });
    } else if (defaultView === "unrolled") {
      get().openTab({
        id: `unrolled:${chartId}`,
        type: "unrolled_editor",
        label: label || "Unrolled Editor",
        closable: true,
      });
    } else {
      get().openTab({
        id: `chart:${chartId}`,
        type: "chart",
        label: label || "Untitled Chart",
        closable: true,
      });
    }
  },

  openLineEventEditor: (lineIndex, lineName) => {
    get().openTab({
      id: `line-events:${lineIndex}`,
      type: "line_event_editor",
      label: `Events: ${lineName}`,
      closable: true,
      data: { lineIndex },
    });
  },

  openPanel: (panelId, label) => {
    get().openTab({
      id: `panel:${panelId}`,
      type: "panel",
      label,
      closable: true,
      data: { panelId },
    });
  },

  openUnifiedEditor: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    let chartId: string | null = null;
    let label = "Unified Editor";
    // Resolve the real chart id (finding L5 — no "current" sentinel). A
    // chart-session tab carries the id in its own tab id; a satellite/home tab
    // inherits the active chart session's id so the view binds to the loaded
    // chart. Using isChartSessionTabId (not the type field) correctly excludes
    // per-line unrolled tabs, whose ":<n>" suffix is a line index, not a chart.
    if (activeTab && isChartSessionTabId(activeTab.id)) {
      chartId = chartGroupKey(activeTab.id);
      label = activeTab.label;
    } else {
      const owner = getActiveChartSessionTabId();
      if (owner) chartId = chartGroupKey(owner);
    }
    get().openTab({
      id: `unified:${chartId ?? "current"}`,
      type: "unified_editor",
      label,
      closable: true,
    });
  },

  openUnrolledEditor: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    let chartId: string | null = null;
    let label = "Unrolled Editor";
    // Resolve the real chart id (finding L5 — see openUnifiedEditor).
    if (activeTab && isChartSessionTabId(activeTab.id)) {
      chartId = chartGroupKey(activeTab.id);
      label = activeTab.label;
    } else {
      const owner = getActiveChartSessionTabId();
      if (owner) chartId = chartGroupKey(owner);
    }
    get().openTab({
      id: `unrolled:${chartId ?? "current"}`,
      type: "unrolled_editor",
      label,
      closable: true,
    });
  },

  openUnrolledLineEditor: (lineIndex, lineName, initialScrollBeat) => {
    // Initialize per-tab scroll beat if this is the first open
    const es = useEditorStore.getState();
    if (es.lineTabScrollBeats[lineIndex] === undefined) {
      es.setLineTabScrollBeat(lineIndex, initialScrollBeat);
    }
    get().openTab({
      id: `unrolled-line:${lineIndex}`,
      type: "unrolled_editor",
      label: lineName,
      closable: true,
      data: { lineIndex },
    });
  },

  getChartTabId: (chartId) => {
    const defaultView = useSettingsStore.getState().defaultEditorView;
    if (defaultView === "unified") return `unified:${chartId}`;
    if (defaultView === "unrolled") return `unrolled:${chartId}`;
    return `chart:${chartId}`;
  },

  // ---- Inline rename ----
  renamingTabId: null,

  startRenameTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const targetId = tabId ?? activeTabId;
    const tab = tabs.find((t) => t.id === targetId);
    // Only allow renaming closable (non-system) tabs
    if (!tab || !tab.closable) return;
    set({ renamingTabId: targetId });
  },

  clearRenaming: () => set({ renamingTabId: null }),
}));

// ============================================================
// Active-chart session routing (finding L5)
//
// Multiple charts can be open at once: every chart:/unified:/unrolled: tab owns
// a ChartSession (chartSessions.ts), and the singleton chart store is swapped on
// tab switch. "Satellite" tabs — panels, the line-event editor, and per-line
// unrolled tabs — are VIEWS of whichever chart is currently loaded, not charts
// of their own. They used to resolve to a literal "current" sentinel, which
// collided across charts and made the panel-tab session save overwrite the
// wrong chart's session (finding H2 — data loss).
//
// `_lastChartTabId` tracks the most recently ACTIVATED real-chart tab. It is set
// from App.tsx's tab-switch effect AFTER that effect saves the outgoing session,
// so a satellite's owner still resolves to the chart currently in the store at
// save time (setting it eagerly in setActiveTab would race the save and clobber
// the outgoing chart). grep getActiveChartSessionTabId / sessionOwnerTabId.
// ============================================================

let _lastChartTabId: string | null = null;

/** True for tabs that OWN a chart session (carry a real chart id in their id). */
export function isChartSessionTabId(tabId: string): boolean {
  return (
    tabId.startsWith("chart:") ||
    tabId.startsWith("unified:") ||
    tabId.startsWith("unrolled:")
  );
}

/** Record the active real-chart tab. Called from the App tab-switch effect. */
export function setActiveChartSessionTabId(tabId: string): void {
  _lastChartTabId = tabId;
}

/** The real-chart tab whose session the loaded chart belongs to: the tracked
 *  last-active chart tab if it still exists, else the first chart-session tab,
 *  else null (no chart open). The existence check guards a stale id left after
 *  the tracked tab was closed. */
export function getActiveChartSessionTabId(): string | null {
  const { tabs } = useTabStore.getState();
  if (_lastChartTabId && tabs.some((t) => t.id === _lastChartTabId)) {
    return _lastChartTabId;
  }
  const found = tabs.find((t) => isChartSessionTabId(t.id));
  return found ? found.id : null;
}

/** The tab id under which `tabId`'s session is stored. Chart-session tabs own
 *  their session; satellite tabs (panel / line-events / per-line unrolled)
 *  resolve to the active chart session. Returns null for tabs tied to no chart
 *  (home). */
export function sessionOwnerTabId(tabId: string): string | null {
  if (isChartSessionTabId(tabId)) return tabId;
  if (
    tabId.startsWith("unrolled-line:") ||
    tabId.startsWith("line-events:") ||
    tabId.startsWith("panel:")
  ) {
    return getActiveChartSessionTabId();
  }
  return null;
}

// ============================================================
// Chart group key — used by App.tsx to detect when two tab IDs reference the
// same underlying chart, so it can skip saving/restoring sessions on view
// switches that don't change the chart. Resolves through sessionOwnerTabId, so
// satellites map to their owning chart's id (no "current" sentinel — L5).
// Returns null for tabs tied to no chart (only "home" today).
// ============================================================
export function chartGroupKey(tabId: string): string | null {
  const owner = sessionOwnerTabId(tabId);
  if (!owner) return null;
  if (owner.startsWith("chart:")) return owner.slice("chart:".length);
  if (owner.startsWith("unified:")) return owner.slice("unified:".length);
  if (owner.startsWith("unrolled:")) return owner.slice("unrolled:".length);
  return null;
}
