// ============================================================
// ContextPanel — Root context panel component
//
// Auto-detects the active mode from the editor selection state
// and renders the appropriate header, tab bar, and content area.
// ============================================================

import { useCallback, useMemo, useRef, useEffect } from "react";
import { useContextPanelMode, getModeTabs, MODE_CONFIG } from "../../hooks/useContextPanelMode";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { useSettingsStore } from "../../stores/settingsStore";
import { useContextPanelStore } from "../../stores/contextPanelStore";
import { ContextPanelHeader } from "./ContextPanelHeader";
import { GlobalMode } from "./modes/GlobalMode";
import { LineMode } from "./modes/LineMode";
import { NoteMode } from "./modes/NoteMode";
import { EventMode } from "./modes/EventMode";
import { MultiLineMode } from "./modes/MultiLineMode";
import { MiscToolsTab } from "./MiscToolsTab";
import { AiTab } from "./modes/AiTab";
import { StepRecordBanner } from "./StepRecordBanner";

// ---- Props ----

export interface ContextPanelProps {
  // Dialog callbacks (misc tools)
  onShowPasteSpecial?: () => void;
  onShowRecordReview?: () => void;
  onShowExportDiff?: () => void;
  onShowSelectiveExport?: () => void;
  onShowGoToBeat?: () => void;
  // Quick action callbacks
  onShowBatchLine?: () => void;
  onShowLyricsSync?: () => void;
  onShowParametric?: () => void;
  onShowSpinGenerator?: () => void;
  onShowShakeGenerator?: () => void;
  // Panel/window controls
  onPopout?: () => void;
  onCollapse?: () => void;
}

// ---- Misc tool action map ----

const MISC_ACTION_MAP: Record<string, keyof ContextPanelProps> = {
  "paste-special": "onShowPasteSpecial",
  "record-review": "onShowRecordReview",
  "export-diff": "onShowExportDiff",
  "selective-export": "onShowSelectiveExport",
  "go-to-beat": "onShowGoToBeat",
  "spin-generator": "onShowSpinGenerator",
  "shake-generator": "onShowShakeGenerator",
};

// ---- Component ----

export function ContextPanel(props: ContextPanelProps) {
  const {
    onPopout = () => {},
    onCollapse = () => {},
  } = props;

  const mode = useContextPanelMode();
  // Subscribe to aiEnabled — `getModeTabs` reads the setting internally,
  // but without this subscription the component wouldn't re-render when
  // the user toggles AI on/off, so the AI tab wouldn't appear/disappear.
  // The useMemo dep on `aiEnabled` ensures tabs are recomputed on toggle.
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const tabs = useMemo(() => getModeTabs(mode), [mode, aiEnabled]);
  const defaultTab = tabs[0]?.id ?? "actions";

  const activeTab = useContextPanelStore((s) => s.getActiveTab(mode, defaultTab));
  const setActiveTab = useContextPanelStore((s) => s.setActiveTab);

  // Track mode+tab to trigger fade animation
  const fadeKey = `${mode}:${activeTab}`;
  const fadeRef = useRef<HTMLDivElement>(null);
  const prevKeyRef = useRef(fadeKey);

  useEffect(() => {
    if (prevKeyRef.current !== fadeKey && fadeRef.current) {
      const el = fadeRef.current;
      el.style.animation = "none";
      // Force reflow
      void el.offsetHeight;
      el.style.animation = "";
      prevKeyRef.current = fadeKey;
    }
  }, [fadeKey]);

  // Keep the active tab visible when the track scrolls sideways
  const tabTrackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabTrackRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab, mode]);

  // Handle tab click
  const handleTabClick = useCallback(
    (tabId: string) => {
      setActiveTab(mode, tabId);
    },
    [mode, setActiveTab],
  );

  // Handle pinned misc item click
  const handlePinnedItemClick = useCallback(
    (itemId: string) => {
      const propKey = MISC_ACTION_MAP[itemId];
      if (propKey) {
        const fn = props[propKey];
        if (typeof fn === "function") (fn as () => void)();
      }
    },
    [props],
  );

  // Build the content for the active tab
  // Collect all action callbacks to pass down to GlobalMode and MiscToolsTab
  const actionProps = useMemo(() => ({
    onShowPasteSpecial: props.onShowPasteSpecial,
    onShowRecordReview: props.onShowRecordReview,
    onShowExportDiff: props.onShowExportDiff,
    onShowSelectiveExport: props.onShowSelectiveExport,
    onShowGoToBeat: props.onShowGoToBeat,
    onShowBatchLine: props.onShowBatchLine,
    onShowLyricsSync: props.onShowLyricsSync,
    onShowParametric: props.onShowParametric,
    onShowSpinGenerator: props.onShowSpinGenerator,
    onShowShakeGenerator: props.onShowShakeGenerator,
  }), [
    props.onShowPasteSpecial,
    props.onShowRecordReview,
    props.onShowExportDiff,
    props.onShowSelectiveExport,
    props.onShowGoToBeat,
    props.onShowBatchLine,
    props.onShowLyricsSync,
    props.onShowParametric,
    props.onShowSpinGenerator,
    props.onShowShakeGenerator,
  ]);

  const content = useMemo(() => {
    // AI tab is shared across all modes — renders the same chat interface
    if (activeTab === "ai") return <AiTab />;
    // Misc tab is shared across all modes
    if (activeTab === "misc") return <MiscToolsTab {...actionProps} />;

    switch (mode) {
      case "global": return <GlobalMode activeTab={activeTab} {...actionProps} />;
      case "line": return <LineMode activeTab={activeTab} />;
      case "note": return <NoteMode activeTab={activeTab} />;
      case "event": return <EventMode activeTab={activeTab} />;
      case "multi": return <MultiLineMode activeTab={activeTab} />;
      default: return null;
    }
  }, [mode, activeTab, actionProps]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-secondary)",
        overflow: "hidden",
      }}
    >
      {/* Scoped fade animation */}
      <style>{`@keyframes ctxFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* Header */}
      <ContextPanelHeader
        mode={mode}
        onPopout={onPopout}
        onCollapse={onCollapse}
        onPinnedItemClick={handlePinnedItemClick}
      />

      {/* Tab bar — segmented control; scrolls sideways when a mode has many tabs */}
      <div style={{ padding: "var(--space-8) var(--space-8) 0", flexShrink: 0 }}>
        <div ref={tabTrackRef} className="ui-segmented ui-segmented--block" role="tablist" aria-label={`${MODE_CONFIG[mode].label} panel`} style={{ overflowX: "auto", scrollbarWidth: "none" }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const button = (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.iconOnly ? tab.label : undefined}
                data-active={isActive || undefined}
                className={isActive ? "ui-segmented__opt is-selected" : "ui-segmented__opt"}
                style={tab.iconOnly ? { flex: "0 0 auto", padding: "0 var(--space-6)" } : { flex: "1 0 auto" }}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.icon && <Icon icon={tab.icon} size={12} />}
                {!tab.iconOnly && tab.label}
              </button>
            );
            // Icon-only tabs are named by a tooltip.
            return tab.iconOnly ? <Tooltip key={tab.id} content={tab.label} position="bottom">{button}</Tooltip> : button;
          })}
        </div>
      </div>

      {/* Content area */}
      <div
        ref={fadeRef}
        className="ctx-fade"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 var(--space-8) var(--space-8)",
          animation: "ctxFadeIn var(--dur-fast) ease-out",
        }}
      >
        {/* Step recording banner — appears in ALL modes when active */}
        <StepRecordBanner />
        {content}
      </div>
    </div>
  );
}
