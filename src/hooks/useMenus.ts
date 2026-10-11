// ============================================================
// Menu System — Global menu definitions and action bindings
//
// Generates the top-level menu structure (File, Edit, View,
// Panels, Help) used by MenuBar and CommandPalette. Each menu
// item has a label, optional shortcut hint, and an action
// closure that calls the appropriate store methods. The hook
// accepts callback props for dialogs and panel toggles.
//
// Recent change: Added "Rename tab" (F2) to View menu for
// inline tab renaming via command palette or keyboard shortcut.
// ============================================================

import { useChartStore } from "../stores/chartStore";
import { useTabStore } from "../stores/tabStore";
import { saveProject } from "../utils/ipc";
import type { ExtraConfig } from "../types/extra";
import type { PanelId } from "../types/editor";
import { useEditorStore } from "../stores/editorStore";
import {
  getSelectedLineIndex,
  getSelectedEventIndices,
  getMultiSelectedLineIndices,
} from "../stores/selection";
import { useGroupStore } from "../stores/groupStore";
import { useBookmarkStore } from "../stores/bookmarkStore";
import { useToastStore } from "../stores/toastStore";
import { showConfirm } from "../components/common/ConfirmDialog";
import { beatToFloat, floatToBeat } from "../types/chart";
import { splitSelectedEventsAtPlayhead } from "../utils/eventSplit";
import { triggerImportChart } from "../utils/importChart";

/** Helper to pick a file via a temporary input element. Returns null if cancelled. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) resolve(null);
        window.removeEventListener("focus", onFocus);
      }, 300);
    };
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

export function useMenus(
  onTogglePanel?: (id: PanelId) => void,
  onResetLayout?: () => void,
  onNewChart?: () => void,
  onShowParametric?: () => void,
  onShowBatchLine?: () => void,
  onShowLyricsSync?: () => void,
  onShowOnDemandPanel?: (id: PanelId) => void,
  onShowPasteSpecial?: () => void,
  onShowGoToBeat?: () => void,
  onShowExportDiff?: () => void,
  onShowSelectiveExport?: () => void,
  onShowSpinGenerator?: () => void,
  onShowShakeGenerator?: () => void,
  onShowNotePattern?: () => void,
  onShowOnsetCalibration?: () => void,
): Menu[] {
  const projectPath = useChartStore((s) => s.projectPath);
  const getChartJson = useChartStore((s) => s.getChartJson);
  // F2: the Save action now uses markCleanIf(token) via getState() (race-safe),
  // so the markClean selector is no longer needed here.
  const closeProject = useChartStore((s) => s.closeProject);
  const canUndo = useChartStore((s) => s.canUndo);
  const canRedo = useChartStore((s) => s.canRedo);
  const isLoaded = useChartStore((s) => s.isLoaded);
  const openUnifiedEditor = useTabStore((s) => s.openUnifiedEditor);
  const openUnrolledEditor = useTabStore((s) => s.openUnrolledEditor);

  return [
    {
      label: "File",
      items: [
        { label: "New chart…", shortcut: "Ctrl+N", action: onNewChart },
        { separator: true, label: "" },
        {
          label: "Save project",
          shortcut: "Ctrl+S",
          disabled: !isLoaded,
          action: async () => {
            if (!projectPath) return;
            // F2: capture the dirty token before the async write (see markCleanIf).
            const cs = useChartStore.getState();
            const token = cs._dirtySeq;
            try {
              await saveProject(projectPath, getChartJson(), JSON.stringify(cs.meta));
              cs.markCleanIf(token);
            } catch (e) {
              console.error("Save failed:", e);
            }
          },
        },
        { label: "Close project", disabled: !isLoaded, action: closeProject },
        { separator: true, label: "" },
        {
          label: "Import chart…",
          action: () => triggerImportChart(),
        },
        {
          label: "Import extra.json…",
          action: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const config = JSON.parse(text) as ExtraConfig;
                useChartStore.getState().setExtraConfig(config);
              } catch (e) {
                console.error("extra.json import failed:", e);
                useToastStore.getState().addToast({ message: "Failed to import extra.json. Check the console for details.", type: "error" });
              }
            };
            input.click();
          },
        },
        {
          label: "Export extra.json",
          disabled: !isLoaded,
          action: () => {
            const config = useChartStore.getState().extraConfig;
            const json = JSON.stringify(config, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "extra.json";
            a.click();
            URL.revokeObjectURL(url);
          },
        },
        { separator: true, label: "" },
        {
          label: "Quit",
          action: async () => {
            const cs = useChartStore.getState();
            if (cs.isDirty) {
              const confirmed = await showConfirm("Your unsaved changes will be lost.", { title: "Quit without saving?", confirmLabel: "Quit", danger: true });
              if (!confirmed) return;
            }
            window.close();
          },
        },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", disabled: !canUndo() && !useBookmarkStore.getState().canUndo(), action: () => {
          // Interleaved undo: compare sequence numbers to decide which store to undo
          const cs = useChartStore.getState();
          const bs = useBookmarkStore.getState();
          const chartTopSeq = cs._pastSeqs.length > 0 ? cs._pastSeqs[cs._pastSeqs.length - 1] : 0;
          const bmTopSeq = bs._pastSeqs.length > 0 ? bs._pastSeqs[bs._pastSeqs.length - 1] : 0;
          if (bmTopSeq > chartTopSeq && bs.canUndo()) { bs.undo(); } else { cs.undo(); }
        }},
        { label: "Redo", shortcut: "Ctrl+Shift+Z", disabled: !canRedo() && !useBookmarkStore.getState().canRedo(), action: () => {
          const cs = useChartStore.getState();
          const bs = useBookmarkStore.getState();
          const chartRedoSeq = cs._futureSeqs.length > 0 ? cs._futureSeqs[cs._futureSeqs.length - 1] : 0;
          const bmRedoSeq = bs._futureSeqs.length > 0 ? bs._futureSeqs[bs._futureSeqs.length - 1] : 0;
          if (bmRedoSeq > chartRedoSeq && bs.canRedo()) { bs.redo(); } else { cs.redo(); }
        }},
        { separator: true, label: "" },
        {
          label: "Create group from selection",
          shortcut: "Ctrl+Shift+G",
          disabled: !isLoaded,
          action: () => {
            const gs = useGroupStore.getState();
            const multiLineIndices = getMultiSelectedLineIndices();
            const selectedLineIndex = getSelectedLineIndex();
            const linesToAdd = multiLineIndices.length > 0
              ? multiLineIndices
              : selectedLineIndex !== null ? [selectedLineIndex] : [];
            if (linesToAdd.length === 0) return;
            const groupId = gs.createLineGroup(`Group ${gs.groups.length + 1}`, [0, 0, 1], [999, 0, 1]);
            for (const li of linesToAdd) gs.addLineToGroup(groupId, li);
            gs.enterGroupEditMode(groupId);
            useEditorStore.getState().setCanvasActivePanel("group-manager");
          },
        },
        {
          label: "Exit group mode",
          disabled: !useGroupStore.getState().activeGroupId,
          action: () => useGroupStore.getState().exitGroupEditMode(),
        },
        { separator: true, label: "" },
        {
          label: "Parametric trajectory…",
          disabled: !isLoaded,
          action: () => onShowParametric?.(),
        },
        {
          label: "Spin / rotation…",
          disabled: !isLoaded,
          action: () => onShowSpinGenerator?.(),
        },
        {
          label: "Shake / oscillation…",
          disabled: !isLoaded,
          action: () => onShowShakeGenerator?.(),
        },
        {
          label: "Improvisation mode",
          shortcut: "Shift+I",
          disabled: !isLoaded,
          action: () => {
            useEditorStore.getState().toggleImprovisationMode();
          },
        },
        { separator: true, label: "" },
        {
          label: "Create multiple lines…",
          disabled: !isLoaded,
          action: () => onShowBatchLine?.(),
        },
        {
          label: "Lyrics sync…",
          disabled: !isLoaded,
          action: () => onShowLyricsSync?.(),
        },
        {
          label: "Note pattern…",
          disabled: !isLoaded,
          action: () => onShowNotePattern?.(),
        },
        { separator: true, label: "" },
        {
          label: "Paste special…",
          shortcut: "Ctrl+Alt+V",
          disabled: !isLoaded,
          action: () => onShowPasteSpecial?.(),
        },
        {
          label: "Go to beat…",
          shortcut: "Ctrl+G", // L7: go_to_beat moved ctrl+j → ctrl+g (registry default)
          disabled: !isLoaded,
          action: () => onShowGoToBeat?.(),
        },
        {
          label: "Onset calibration…",
          shortcut: "Ctrl+Shift+O",
          disabled: !isLoaded,
          action: () => onShowOnsetCalibration?.(),
        },
        { separator: true, label: "" },
        {
          label: "Split event at playhead",
          disabled: !isLoaded,
          // Shared with the split_event hotkey (L7). grep splitSelectedEventsAtPlayhead.
          action: () => splitSelectedEventsAtPlayhead(),
        },
        {
          label: "Duplicate event after",
          disabled: !isLoaded,
          action: () => {
            // Clone selected events and place immediately after their end beat
            const cs = useChartStore.getState();
            const lineIndex = getSelectedLineIndex();
            const eventIndices = getSelectedEventIndices();
            if (lineIndex === null || eventIndices.length === 0) return;
            const line = cs.chart.lines[lineIndex];
            if (!line) return;

            const newEvents = eventIndices.map((idx) => {
              const event = line.events[idx];
              const duration = beatToFloat(event.end_beat) - beatToFloat(event.start_beat);
              return {
                ...structuredClone(event),
                start_beat: event.end_beat,
                end_beat: floatToBeat(beatToFloat(event.end_beat) + duration),
              };
            });

            cs.batchMultiLineMutations([{ lineIndex, newEvents }]);
          },
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Unified editor",
          disabled: !isLoaded,
          action: () => openUnifiedEditor(),
        },
        {
          label: "Unrolled editor",
          shortcut: "Ctrl+Shift+U",
          disabled: !isLoaded,
          action: () => openUnrolledEditor(),
        },
        {
          label: "Classic editor",
          disabled: !isLoaded,
          action: () => {
            const ts = useTabStore.getState();
            const chartTab = ts.tabs.find((t) => t.type === "chart");
            if (chartTab) {
              ts.setActiveTab(chartTab.id);
            } else {
              const meta = useChartStore.getState().meta;
              ts.openTab({
                id: "chart:current",
                type: "chart",
                label: meta.name || "Chart",
                closable: true,
              });
            }
          },
        },
        { separator: true, label: "" },
        {
          label: "Rename tab",
          shortcut: "F2",
          action: () => {
            useTabStore.getState().startRenameTab();
          },
        },
        { separator: true, label: "" },
        { label: "Timeline", shortcut: "Alt+1", action: () => onTogglePanel?.("timeline") },
        { label: "Lines", shortcut: "Alt+2", action: () => onTogglePanel?.("line-list") },
        { label: "Effects", shortcut: "Alt+3", action: () => onTogglePanel?.("effects") },
        { separator: true, label: "" },
        { label: "Inspector", action: () => onTogglePanel?.("inspector") },
        { label: "Toolbar", action: () => onTogglePanel?.("toolbar") },
        { label: "Timeline settings", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("timeline-settings") },
        { label: "BPM list", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("bpm-list") },
        { label: "Chart settings", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("chart-settings") },
        { label: "Validation", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("validation") },
        { label: "Textures", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("textures") },
        { label: "Groups", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("group-manager") },
        { label: "Presets", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("presets") },
        { label: "Game preview", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("game-preview") },
        { label: "Hotkey reference", action: () => (onShowOnDemandPanel ?? onTogglePanel)?.("hotkey-reference") },
        { label: "DevTools", shortcut: "F12", action: () => useEditorStore.getState().toggleDevTools() },
        { separator: true, label: "" },
        { label: "Apply default layout", action: onResetLayout },
      ],
    },
    {
      label: "Export",
      items: [
        {
          label: "Export as official JSON",
          disabled: !isLoaded,
          action: async () => {
            try {
              const { convertPhichainToOfficial } = await import("../utils/officialExport");
              const chart = JSON.parse(getChartJson());
              const officialJson = convertPhichainToOfficial(chart);
              const blob = new Blob([officialJson], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              const meta = useChartStore.getState().meta;
              a.download = `${meta.name || "chart"}_official.json`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error("Official export failed:", e);
              useToastStore.getState().addToast({ message: "Failed to export Official chart. Check the console for details.", type: "error" });
            }
          },
        },
        {
          label: "Export as RPE JSON",
          disabled: !isLoaded,
          action: async () => {
            try {
              const { convertPhichainToRpe } = await import("../utils/rpeExport");
              const chart = JSON.parse(getChartJson());
              const meta = useChartStore.getState().meta;
              const rpeJson = convertPhichainToRpe(chart, meta);
              const blob = new Blob([rpeJson], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${meta.name || "chart"}.json`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error("RPE export failed:", e);
              useToastStore.getState().addToast({ message: "Failed to export RPE chart. Check the console for details.", type: "error" });
            }
          },
        },
        {
          label: "Export as PEC",
          disabled: !isLoaded,
          action: async () => {
            try {
              const { convertPhichainToPec } = await import("../utils/pecExport");
              const chart = JSON.parse(getChartJson());
              const pecText = convertPhichainToPec(chart);
              const blob = new Blob([pecText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              const meta = useChartStore.getState().meta;
              a.download = `${meta.name || "chart"}.pec`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error("PEC export failed:", e);
              useToastStore.getState().addToast({ message: "Failed to export PEC chart. Check the console for details.", type: "error" });
            }
          },
        },
        {
          label: "Export as PEZ (ZIP bundle)…",
          disabled: !isLoaded,
          action: async () => {
            try {
              const chart = JSON.parse(getChartJson());
              const cs = useChartStore.getState();
              const meta = cs.meta;

              let musicFile: File | null = null;
              const musicConfirm = await showConfirm("Pick an audio file to bundle with the chart, or skip it.", { title: "Include a music file?", confirmLabel: "Choose file…", cancelLabel: "Skip" });
              if (musicConfirm) {
                musicFile = await pickFile(".mp3,.ogg,.wav,.flac");
              }

              let illustrationFile: File | null = null;
              const hasLoadedIllustration = cs.illustrationImage !== null;
              if (!hasLoadedIllustration) {
                const illuConfirm = await showConfirm("Pick an image to bundle with the chart, or skip it.", { title: "Include an illustration?", confirmLabel: "Choose file…", cancelLabel: "Skip" });
                if (illuConfirm) {
                  illustrationFile = await pickFile(".png,.jpg,.jpeg,.bmp,.webp");
                }
              }

              const { createPezBundle } = await import("../utils/pezExport");
              const groups = useGroupStore.getState().groups;
              const bookmarks = useBookmarkStore.getState().bookmarks;
              const pezBlob = await createPezBundle({
                chart,
                meta,
                musicFile,
                illustrationImage: cs.illustrationImage,
                illustrationFile,
                extraConfig: cs.extraConfig,
                lineTextures: cs.lineTextures,
                groups: groups.length > 0 ? groups : null,
                bookmarks: bookmarks.length > 0 ? bookmarks : null,
              });

              const url = URL.createObjectURL(pezBlob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${meta.name || "chart"}.pez`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              console.error("PEZ export failed:", e);
              useToastStore.getState().addToast({ message: "Failed to export PEZ bundle. Check the console for details.", type: "error" });
            }
          },
        },
        { separator: true, label: "" },
        {
          label: "Export diff…",
          disabled: !isLoaded,
          action: () => onShowExportDiff?.(),
        },
        {
          label: "Selective export…",
          disabled: !isLoaded,
          action: () => onShowSelectiveExport?.(),
        },
      ],
    },
  ];
}
