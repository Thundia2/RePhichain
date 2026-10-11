import { useState, useCallback, useEffect, useRef } from "react";
import {
  Mosaic,
  MosaicWindow,
  getLeaves,
  createBalancedTreeFromLeaves,
  RemoveButton,
} from "react-mosaic-component";
import type { MosaicNode } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";

import type { PanelId } from "./types/editor";
import { useChartStore } from "./stores/chartStore";
import {
  useTabStore,
  chartGroupKey,
  isChartSessionTabId,
  sessionOwnerTabId,
  setActiveChartSessionTabId,
} from "./stores/tabStore";
import {
  saveSession,
  restoreSession,
  deleteSession,
  shouldSkipSave,
  shouldSkipRestore,
} from "./utils/chartSessions";

import { MenuBar } from "./components/MenuBar/MenuBar";
import { TabBar } from "./components/TabBar/TabBar";
import { StatusBar } from "./components/StatusBar/StatusBar";
import { QuickActionBar } from "./components/QuickActionBar/QuickActionBar";
import { PanelPlaceholder } from "./components/common/PanelPlaceholder";
import { CustomExpandButton } from "./components/common/CustomExpandButton";
import { Tooltip } from "./components/common/Tooltip";
import { GamePreview } from "./components/GamePreview/GamePreview";
import { GamePreviewTab } from "./components/GamePreview/GamePreviewTab";
import { Timeline } from "./components/Timeline/Timeline";
import { Toolbar } from "./components/Toolbar/Toolbar";
import { LineList } from "./components/LineList/LineList";
import { Inspector } from "./components/Inspector/Inspector";
import { TimelineSettings } from "./components/TimelineSettings/TimelineSettings";
import { BpmListPanel } from "./components/BpmList/BpmList";
import { ChartSettings } from "./components/ChartSettings/ChartSettings";
import { NewProjectDialog } from "./components/NewProjectDialog/NewProjectDialog";
import { HomeScreen } from "./components/Home/HomeScreen";
import { SettingsModal } from "./components/SettingsModal/SettingsModal";
import { CommandPalette } from "./components/CommandPalette/CommandPalette";
import { DevToolsPanel } from "./components/DevToolsPanel/DevToolsPanel";
import { LineEventEditor } from "./components/LineEventEditor/LineEventEditor";
import { UnifiedEditorTab } from "./components/UnifiedCanvas/UnifiedEditorTab";
import { UnrolledEditorTab } from "./components/UnrolledCanvas/UnrolledEditorTab";
import { ValidationPanel } from "./components/Validation/ValidationPanel";
import { EffectsEditor } from "./components/EffectsEditor/EffectsEditor";
import { PresetPanel } from "./components/PresetPanel/PresetPanel";
import { ParametricDialog } from "./components/ParametricDialog/ParametricDialog";
import { NotePatternDialog } from "./components/NotePatternDialog/NotePatternDialog";
import { SpinGeneratorDialog } from "./components/SpinGeneratorDialog/SpinGeneratorDialog";
import { ShakeGeneratorDialog } from "./components/ShakeGenerator/ShakeGenerator";
import { BatchLineDialog } from "./components/BatchLineDialog/BatchLineDialog";
import { LyricsSyncDialog } from "./components/LyricsSyncDialog/LyricsSyncDialog";
import { PasteSpecialDialog } from "./components/PasteSpecialDialog/PasteSpecialDialog";
import { GoToBeatDialog } from "./components/GoToBeatDialog/GoToBeatDialog";
import { OnsetCalibrationDialog } from "./components/OnsetCalibrationDialog/OnsetCalibrationDialog";
import { ExportDiffDialog } from "./components/ExportDiffDialog/ExportDiffDialog";
import { SelectiveExportDialog } from "./components/SelectiveExportDialog/SelectiveExportDialog";
import { RecordReviewDialog } from "./components/RecordReviewDialog/RecordReviewDialog";
import { ContextPanelSidebar } from "./components/ContextPanel/ContextPanelSidebar";
import { FavoritesWizard } from "./components/ContextPanel/wizard/FavoritesWizard";
import { useEditorStore } from "./stores/editorStore";
import { useAudioStore } from "./stores/audioStore";
import { useDialogStore } from "./stores/dialogStore";
import { useToastStore } from "./stores/toastStore";
import { audioEngine } from "./audio/audioEngine";
import { useGlobalHotkeys } from "./hooks/useHotkeys";
import { useOnsetDetection } from "./hooks/useOnsetDetection";
import { useClipboard } from "./hooks/useClipboard";
import { triggerImportChart } from "./utils/importChart";
import { commitRecordedKeyframes } from "./utils/recordingCommit";
import { ToastContainer } from "./components/common/Toast";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { PromptDialog } from "./components/common/PromptDialog";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { OnboardingOverlay } from "./components/Onboarding/OnboardingOverlay";
import { useSettingsStore } from "./stores/settingsStore";

// ============================================================
// CONFIGURABLE: Default panel layout
// ============================================================
const DEFAULT_LAYOUT: MosaicNode<PanelId> = {
  direction: "row",
  first: {
    direction: "column",
    first: "line-list",
    second: "toolbar",
    splitPercentage: 75,
  },
  second: {
    direction: "row",
    first: "timeline",
    second: {
      direction: "column",
      first: "game-preview",
      second: {
        direction: "row",
        first: "inspector",
        second: "timeline-settings",
        splitPercentage: 50,
      },
      splitPercentage: 60,
    },
    splitPercentage: 55,
  },
  splitPercentage: 15,
};

// ============================================================
// CONFIGURABLE: Panel display names
// ============================================================
const PANEL_TITLES: Record<PanelId, string> = {
  "game-preview": "Preview",
  "timeline": "Timeline",
  "inspector": "Inspector",
  "line-list": "Lines",
  "toolbar": "Toolbar",
  "timeline-settings": "Timeline settings",
  "bpm-list": "BPM list",
  "chart-settings": "Chart settings",
  "hotkey-reference": "Hotkey reference",
  "validation": "Validation",
  "effects": "Effects",
  "textures": "Textures",
  "group-manager": "Groups",
  "presets": "Presets",
};

function renderPanel(id: PanelId) {
  const title = PANEL_TITLES[id] ?? id;
  let content;
  switch (id) {
    case "game-preview":
      content = <GamePreview />;
      break;
    case "timeline":
      content = <Timeline />;
      break;
    case "inspector":
      content = <Inspector />;
      break;
    case "line-list":
      content = <LineList />;
      break;
    case "toolbar":
      content = <Toolbar />;
      break;
    case "timeline-settings":
      content = <TimelineSettings />;
      break;
    case "bpm-list":
      content = <BpmListPanel />;
      break;
    case "chart-settings":
      content = <ChartSettings />;
      break;
    case "validation":
      content = <ValidationPanel />;
      break;
    case "effects":
      content = <EffectsEditor />;
      break;
    case "presets":
      content = <PresetPanel />;
      break;
    default:
      return <PanelPlaceholder name={title} description="Coming soon" color="var(--text-secondary)" />;
  }
  return <ErrorBoundary panelName={title}>{content}</ErrorBoundary>;
}

/** Render a standalone panel tab based on its panelId */
function renderPanelTab(panelId: string) {
  switch (panelId as PanelId) {
    case "game-preview":
      return <GamePreviewTab />;
    case "timeline":
      return <Timeline />;
    case "inspector":
      return <Inspector />;
    case "line-list":
      return <LineList />;
    case "toolbar":
      return <Toolbar />;
    case "timeline-settings":
      return <TimelineSettings />;
    case "bpm-list":
      return <BpmListPanel />;
    case "chart-settings":
      return <ChartSettings />;
    case "validation":
      return <ValidationPanel />;
    case "effects":
      return <EffectsEditor />;
    default:
      return (
        <PanelPlaceholder
          name={PANEL_TITLES[panelId as PanelId] ?? panelId}
          description="Standalone view"
          color="var(--text-muted)"
        />
      );
  }
}

/**
 * Find the chart tab ID associated with a given tab.
 * Panel tabs and line-event-editor tabs belong to the currently active chart.
 */
export default function App() {
  const [layout, setLayout] = useState<MosaicNode<PanelId> | null>(DEFAULT_LAYOUT);
  // Dialog state managed via dialogStore (eliminates prop drilling)
  const { openDialog, closeDialog, toggleDialog } = useDialogStore();
  const showNewProject = useDialogStore((s) => s.openDialogs.has("new-project"));
  const showParametric = useDialogStore((s) => s.openDialogs.has("parametric"));
  const showBatchLine = useDialogStore((s) => s.openDialogs.has("batch-line"));
  const showLyricsSync = useDialogStore((s) => s.openDialogs.has("lyrics-sync"));
  const showNotePattern = useDialogStore((s) => s.openDialogs.has("note-pattern"));
  const showSpinGenerator = useDialogStore((s) => s.openDialogs.has("spin-generator"));
  const showShakeGenerator = useDialogStore((s) => s.openDialogs.has("shake-generator"));
  const showPasteSpecial = useDialogStore((s) => s.openDialogs.has("paste-special"));
  const showGoToBeat = useDialogStore((s) => s.openDialogs.has("go-to-beat"));
  // Phase C of onset plan (2026-04-20): calibration dialog opened from the
  // Edit menu, command palette, or Ctrl+Shift+O. Renders alongside the other
  // modal dialogs at the end of App.
  const showOnsetCalibration = useDialogStore((s) => s.openDialogs.has("onset-calibration"));
  const showExportDiff = useDialogStore((s) => s.openDialogs.has("export-diff"));
  const showSelectiveExport = useDialogStore((s) => s.openDialogs.has("selective-export"));
  const showRecordReview = useDialogStore((s) => s.openDialogs.has("record-review"));
  const showSettings = useDialogStore((s) => s.openDialogs.has("settings"));
  const showCommandPalette = useDialogStore((s) => s.openDialogs.has("command-palette"));
  const showOnboarding = useDialogStore((s) => s.openDialogs.has("onboarding"));
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const settingsLoaded = useSettingsStore((s) => s.settingsLoaded);
  const [expandedPanelId, setExpandedPanelId] = useState<PanelId | null>(null);
  const savedLayoutRef = useRef<MosaicNode<PanelId> | null>(null);
  const prevTabIdRef = useRef<string | null>(null);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const openPanel = useTabStore((s) => s.openPanel);
  const isLoaded = useChartStore((s) => s.isLoaded);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  useGlobalHotkeys({
    onNewChart: () => openDialog("new-project"),
    onCommandPalette: () => toggleDialog("command-palette"),
    onImportChart: triggerImportChart,
    onShowGoToBeat: () => openDialog("go-to-beat"),
    onShowPasteSpecial: () => openDialog("paste-special"),
    onShowOnsetCalibration: () => openDialog("onset-calibration"),
  });
  useClipboard();
  useOnsetDetection();

  // ---- Multi-chart session management ----
  // When the active tab changes, save the old chart's state and restore
  // the new chart's state.
  useEffect(() => {
    const prevTabId = prevTabIdRef.current;
    prevTabIdRef.current = activeTabId;

    const newTab = tabs.find((t) => t.id === activeTabId);

    // Same tab (re-render without a tab change): the active-chart pointer is
    // already correct.
    if (prevTabId === activeTabId) return;
    if (prevTabId === null) {
      // First activation (boot). No outgoing tab to save; just record the
      // active chart so later satellite tabs resolve their session correctly.
      if (newTab && isChartSessionTabId(newTab.id)) setActiveChartSessionTabId(newTab.id);
      return;
    }

    const prevTab = tabs.find((t) => t.id === prevTabId);

    // Skip save/restore entirely when both tabs reference the SAME chart group
    // (e.g. unified:A ↔ unrolled:A, or unified:A ↔ a panel/line-events view of
    // A). The chart store already holds the right state — saving + restoring
    // would write a stale snapshot back and discard in-flight edits the user
    // just made in the previous view. Satellite tabs now resolve to their
    // owning chart (finding L5, no "current" sentinel), so this fires across
    // genuinely different charts only.
    const prevKey = prevTab ? chartGroupKey(prevTab.id) : null;
    const newKey = newTab ? chartGroupKey(newTab.id) : null;
    if (prevKey !== null && newKey !== null && prevKey === newKey) {
      if (newTab && isChartSessionTabId(newTab.id)) setActiveChartSessionTabId(newTab.id);
      return;
    }

    // Save the OUTGOING chart under its session-owning tab id. For satellite
    // tabs (panel / line-events / per-line unrolled) that's the active chart
    // session — resolved via the still-current active-chart pointer, since we
    // only advance it AFTER this save (finding L5/H2/T1: the old code saved
    // under a positional "last chart-like tab" guess that could overwrite a
    // different chart's session).
    if (shouldSkipSave()) {
      // An entry point already saved the outgoing session.
    } else if (prevTab && isLoaded) {
      const saveId = sessionOwnerTabId(prevTab.id);
      if (saveId) saveSession(saveId);
    }

    // Restore session when entering a real-chart tab. Satellite tabs share the
    // already-loaded chart (covered by the same-group skip above), so they
    // don't restore.
    if (newTab && isChartSessionTabId(newTab.id) && !shouldSkipRestore()) {
      restoreSession(newTab.id).catch((err) => {
        console.warn("[App] Failed to restore chart session:", err);
      });
    }

    // Advance the active-chart pointer to the incoming chart, AFTER the save
    // above so satellite saves resolved to the OUTGOING chart.
    if (newTab && isChartSessionTabId(newTab.id)) setActiveChartSessionTabId(newTab.id);
  }, [activeTabId, tabs, isLoaded]);

  // First run: open the welcome tour the first time an editor shows a loaded
  // chart. Closing it records hasSeenOnboarding, so it opens only once. Waits
  // for the saved settings so a returning user never sees it flash up.
  const inEditor =
    activeTab?.type === "unified_editor" || activeTab?.type === "unrolled_editor" || activeTab?.type === "chart";
  useEffect(() => {
    if (settingsLoaded && isLoaded && inEditor && !hasSeenOnboarding) openDialog("onboarding");
  }, [settingsLoaded, isLoaded, inEditor, hasSeenOnboarding, openDialog]);

  const closeOnboarding = useCallback(() => {
    closeDialog("onboarding");
    useSettingsStore.getState().updateSettings({ hasSeenOnboarding: true });
  }, [closeDialog]);

  // When chart is closed, unload audio, close chart tabs, and clean up sessions.
  // This prevents stale audio/illustration from leaking into a new chart.
  useEffect(() => {
    if (!isLoaded) {
      // Stop and unload audio so it doesn't keep playing after close
      audioEngine.unload();
      useAudioStore.getState().setMusicLoaded(false);

      // Close any open dialogs to prevent orphaned dialogs from previous project
      useDialogStore.getState().clearAll();

      const tabState = useTabStore.getState();
      const chartTabs = tabState.tabs.filter(
        (t) => t.type === "chart" || t.type === "line_event_editor" || t.type === "panel" || t.type === "unified_editor" || t.type === "unrolled_editor",
      );
      for (const t of chartTabs) {
        deleteSession(t.id);
        tabState.closeTab(t.id);
      }
    }
  }, [isLoaded]);

  // Clean up sessions when individual tabs are closed
  useEffect(() => {
    // We can't easily iterate the session map here, but we can
    // clean up when tabs disappear. The deleteSession calls are
    // handled via the closeProject flow above and closeTab handler below.
  }, [tabs]);

  /** Handle first-click expand: save layout, maximize the panel */
  const handleExpand = useCallback(
    (panelId: PanelId) => {
      savedLayoutRef.current = layout;
      setExpandedPanelId(panelId);
    },
    [layout],
  );

  /** Handle collapse: restore layout from before expand */
  const handleCollapse = useCallback(() => {
    if (savedLayoutRef.current) {
      setLayout(savedLayoutRef.current);
      savedLayoutRef.current = null;
    }
    setExpandedPanelId(null);
  }, []);

  /** Handle second-click expand: open as tab, restore layout */
  const handleOpenAsTab = useCallback(
    (panelId: PanelId) => {
      const title = PANEL_TITLES[panelId] ?? panelId;
      openPanel(panelId, title);

      if (savedLayoutRef.current) {
        setLayout(savedLayoutRef.current);
        savedLayoutRef.current = null;
      }
      setExpandedPanelId(null);
    },
    [openPanel],
  );

  /** Add a panel to the layout if it isn't already visible */
  const togglePanel = useCallback(
    (panelId: PanelId) => {
      // In unified/unrolled editor mode, route to the canvas panel drawer
      if (activeTab?.type === "unified_editor" || activeTab?.type === "unrolled_editor") {
        const { toggleCanvasPanel } = useEditorStore.getState();
        toggleCanvasPanel(panelId);
        return;
      }

      if (!layout) {
        setLayout(panelId);
        return;
      }
      const leaves = getLeaves(layout);
      if (leaves.includes(panelId)) return;
      setLayout(createBalancedTreeFromLeaves([...leaves, panelId]));
    },
    [layout, activeTab],
  );

  /** Open an on-demand panel as an overlay in the unified editor drawer */
  const handleShowOnDemandPanel = useCallback((id: PanelId) => {
    if (activeTab?.type === "unified_editor" || activeTab?.type === "unrolled_editor") {
      const es = useEditorStore.getState();
      // Ensure the drawer is open (default to timeline if closed)
      if (!es.canvasActivePanelId) es.setCanvasActivePanel("timeline");
      es.setOnDemandOverlay(id);
    } else {
      // In classic mode, treat on-demand panels as regular toggles
      togglePanel(id);
    }
  }, [activeTab, togglePanel]);

  /** Reset layout to defaults */
  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    setExpandedPanelId(null);
    savedLayoutRef.current = null;
  }, []);

  const handleLayoutChange = useCallback(
    (newLayout: MosaicNode<PanelId> | null) => {
      setLayout(newLayout);
    },
    [],
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <MenuBar
        onTogglePanel={togglePanel}
        onResetLayout={resetLayout}
        onNewChart={() => openDialog("new-project")}
        onOpenSettings={() => openDialog("settings")}
        onOpenCommandPalette={() => openDialog("command-palette")}
        onShowParametric={() => openDialog("parametric")}
        onShowBatchLine={() => openDialog("batch-line")}
        onShowLyricsSync={() => openDialog("lyrics-sync")}
        onShowOnDemandPanel={handleShowOnDemandPanel}
        onShowPasteSpecial={() => openDialog("paste-special")}
        onShowGoToBeat={() => openDialog("go-to-beat")}
        onShowExportDiff={() => openDialog("export-diff")}
        onShowSelectiveExport={() => openDialog("selective-export")}
        onShowSpinGenerator={() => openDialog("spin-generator")}
        onShowShakeGenerator={() => openDialog("shake-generator")}
        onShowNotePattern={() => openDialog("note-pattern")}
        onShowOnsetCalibration={() => openDialog("onset-calibration")}
      />
      <TabBar />

      {activeTab.type === "chart" && <QuickActionBar />}

      <div className="flex-1 overflow-hidden relative flex">
        <div className="flex-1 overflow-hidden relative">
        {activeTab.type === "home" && (
          <HomeScreen onNewChart={() => openDialog("new-project")} onImportChart={triggerImportChart} />
        )}
        {activeTab.type === "chart" && (
          <Mosaic<PanelId>
            renderTile={(id, path) => (
              <MosaicWindow<PanelId>
                path={path}
                title={PANEL_TITLES[id]}
                toolbarControls={[
                  /* Collapse button — only visible when this panel is expanded */
                  expandedPanelId === id && (
                    <Tooltip key="collapse" content="Restore layout">
                      <button
                        type="button"
                        className="mosaic-default-control bp3-button bp3-minimal collapse-button"
                        aria-label="Restore layout"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCollapse();
                        }}
                      />
                    </Tooltip>
                  ),
                  <CustomExpandButton
                    key="expand"
                    panelId={id}
                    isExpanded={expandedPanelId === id}
                    onExpand={handleExpand}
                    onOpenAsTab={handleOpenAsTab}
                  />,
                  <RemoveButton key="remove" />,
                ]}
              >
                <div className="panel-container">
                  <div className="panel-body">
                    {renderPanel(id)}
                  </div>
                </div>
              </MosaicWindow>
            )}
            value={layout}
            onChange={handleLayoutChange}
            className="mosaic-dark-theme"
          />
        )}
        {/* UC2-c: the editor surfaces get their own ErrorBoundary so a render
            throw (e.g. a transient out-of-range index mid-undo) shows a Retry
            card instead of unmounting the whole app to a white screen. The
            underlying crash is already dead (L2 made selection uid-resolved),
            this is defense-in-depth. */}
        {activeTab.type === "line_event_editor" && activeTab.data && (
          <ErrorBoundary panelName="Line Event Editor">
            <LineEventEditor lineIndex={activeTab.data.lineIndex as number} />
          </ErrorBoundary>
        )}
        {activeTab.type === "unified_editor" && (
          <ErrorBoundary panelName="Unified Editor">
            <UnifiedEditorTab />
          </ErrorBoundary>
        )}
        {activeTab.type === "unrolled_editor" && (
          <ErrorBoundary panelName="Unrolled Editor">
            <UnrolledEditorTab lineIndex={activeTab.data?.lineIndex as number | undefined} />
          </ErrorBoundary>
        )}
        {activeTab.type === "panel" && activeTab.data && (
          <div className="w-full h-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
            {renderPanelTab(activeTab.data.panelId as string)}
          </div>
        )}
        </div>
        {isLoaded && (
          <ContextPanelSidebar
            onShowPasteSpecial={() => openDialog("paste-special")}
            onShowRecordReview={() => openDialog("record-review")}
            onShowExportDiff={() => openDialog("export-diff")}
            onShowSelectiveExport={() => openDialog("selective-export")}
            onShowGoToBeat={() => openDialog("go-to-beat")}
            onShowBatchLine={() => openDialog("batch-line")}
            onShowLyricsSync={() => openDialog("lyrics-sync")}
            onShowParametric={() => openDialog("parametric")}
            onShowSpinGenerator={() => openDialog("spin-generator")}
            onShowShakeGenerator={() => openDialog("shake-generator")}
          />
        )}
      </div>

      {(activeTab.type === "chart" || activeTab.type === "panel") && <StatusBar />}
      <NewProjectDialog open={showNewProject} onClose={() => closeDialog("new-project")} />
      <ParametricDialog open={showParametric} onClose={() => closeDialog("parametric")} />
      <BatchLineDialog open={showBatchLine} onClose={() => closeDialog("batch-line")} />
      <LyricsSyncDialog open={showLyricsSync} onClose={() => closeDialog("lyrics-sync")} />
      <NotePatternDialog open={showNotePattern} onClose={() => closeDialog("note-pattern")} />
      <SpinGeneratorDialog open={showSpinGenerator} onClose={() => closeDialog("spin-generator")} />
      <ShakeGeneratorDialog open={showShakeGenerator} onClose={() => closeDialog("shake-generator")} />
      <SettingsModal open={showSettings} onClose={() => closeDialog("settings")} />
      <PasteSpecialDialog open={showPasteSpecial} onClose={() => closeDialog("paste-special")} />
      <GoToBeatDialog open={showGoToBeat} onClose={() => closeDialog("go-to-beat")} />
      <OnsetCalibrationDialog open={showOnsetCalibration} onClose={() => closeDialog("onset-calibration")} />
      <ExportDiffDialog open={showExportDiff} onClose={() => closeDialog("export-diff")} />
      <SelectiveExportDialog open={showSelectiveExport} onClose={() => closeDialog("selective-export")} />
      <RecordReviewDialog
        open={showRecordReview}
        onClose={() => closeDialog("record-review")}
        onAccept={(simplifyThreshold) => {
          // D1 (critical): actually commit the recording. The old handler just
          // closed the dialog, silently discarding every recorded keyframe.
          const result = commitRecordedKeyframes(simplifyThreshold);
          if (result.ok) {
            useToastStore.getState().addToast(
              result.committed > 0
                ? { message: `Recording applied — ${result.committed} event${result.committed === 1 ? "" : "s"} added`, type: "success" }
                : { message: "Recording had no usable channels — nothing applied", type: "info" },
            );
          } else {
            useToastStore.getState().addToast({
              message: result.reason === "no-line"
                ? "Select a line before applying the recording"
                : "No recording to apply",
              type: "error",
            });
          }
          closeDialog("record-review");
        }}
      />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => closeDialog("command-palette")}
        onTogglePanel={togglePanel}
        onResetLayout={resetLayout}
        onNewChart={() => openDialog("new-project")}
        onShowParametric={() => openDialog("parametric")}
        onShowBatchLine={() => openDialog("batch-line")}
        onShowLyricsSync={() => openDialog("lyrics-sync")}
        onShowOnDemandPanel={handleShowOnDemandPanel}
        onShowPasteSpecial={() => openDialog("paste-special")}
        onShowGoToBeat={() => openDialog("go-to-beat")}
        onShowExportDiff={() => openDialog("export-diff")}
        onShowSelectiveExport={() => openDialog("selective-export")}
        onShowSpinGenerator={() => openDialog("spin-generator")}
        onShowShakeGenerator={() => openDialog("shake-generator")}
        onShowOnsetCalibration={() => openDialog("onset-calibration")}
      />
      <FavoritesWizard />
      <OnboardingOverlay open={showOnboarding} onClose={closeOnboarding} />
      <DevToolsPanel />
      <ToastContainer />
      <ConfirmDialog />
      <PromptDialog />
    </div>
  );
}
