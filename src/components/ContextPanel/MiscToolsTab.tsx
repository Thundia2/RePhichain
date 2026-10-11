// ============================================================
// MiscToolsTab — grid of tool cards
//
// 2-column grid of filled bg-active cards with a Lucide icon and
// label, and a pin toggle (revealed on hover/focus, or when pinned).
// Pinned items show in the ContextPanelHeader quick-access bar.
// ============================================================

import type React from "react";
import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardPaste, FileDiff, LocateFixed, Mic, MicVocal, Package, Pin, PinOff,
  Rows3, Sparkles, Spline, Tornado, Vibrate,
} from "lucide-react";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import { useContextPanelStore } from "../../stores/contextPanelStore";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  getSelectedLineIndex,
  getSelectedNoteIndices,
  getSelectedEventIndices,
  getMultiSelectedLineIndices,
} from "../../stores/selection";

// ---- Tool definitions ----

interface MiscTool {
  id: string;
  label: string;
  icon: LucideIcon;
  actionKey: keyof MiscToolsTabProps;
}

// Tools section — dialog shortcuts (icons/labels match ContextPanelHeader's pinned bar)
const MISC_TOOLS: MiscTool[] = [
  { id: "paste-special", label: "Paste special…", icon: ClipboardPaste, actionKey: "onShowPasteSpecial" },
  { id: "record-review", label: "Review recording…", icon: Mic, actionKey: "onShowRecordReview" },
  { id: "export-diff", label: "Export diff…", icon: FileDiff, actionKey: "onShowExportDiff" },
  { id: "selective-export", label: "Selective export…", icon: Package, actionKey: "onShowSelectiveExport" },
  { id: "go-to-beat", label: "Go to beat…", icon: LocateFixed, actionKey: "onShowGoToBeat" },
];

// Quick actions section
const QUICK_ACTION_TOOLS: MiscTool[] = [
  { id: "batch-lines", label: "Batch create lines…", icon: Rows3, actionKey: "onShowBatchLine" },
  { id: "lyrics-sync", label: "Lyrics sync…", icon: MicVocal, actionKey: "onShowLyricsSync" },
  { id: "parametric", label: "Parametric trajectory…", icon: Spline, actionKey: "onShowParametric" },
  { id: "spin-generator", label: "Spin generator…", icon: Tornado, actionKey: "onShowSpinGenerator" },
  { id: "shake-generator", label: "Shake generator…", icon: Vibrate, actionKey: "onShowShakeGenerator" },
];

// ---- Props ----

export interface MiscToolsTabProps {
  // Dialog tools
  onShowPasteSpecial?: () => void;
  onShowRecordReview?: () => void;
  onShowExportDiff?: () => void;
  onShowSelectiveExport?: () => void;
  onShowGoToBeat?: () => void;
  // Quick actions
  onShowBatchLine?: () => void;
  onShowLyricsSync?: () => void;
  onShowParametric?: () => void;
  onShowSpinGenerator?: () => void;
  onShowShakeGenerator?: () => void;
}

// ---- Styles ----

// Pin reveal lives in CSS (hover / focus-within) instead of JS hover state.
const CARD_CSS = `
.misc-tool-card .misc-tool-pin { opacity: 0; transition: opacity var(--dur-fast); }
.misc-tool-card:hover .misc-tool-pin,
.misc-tool-card:focus-within .misc-tool-pin,
.misc-tool-card .misc-tool-pin.is-active { opacity: 1; }
`;

const CARD_STYLE: React.CSSProperties = {
  flexDirection: "column",
  gap: "var(--space-6)",
  width: "100%",
  height: "auto",
  minHeight: 72,
  padding: "var(--space-12) var(--space-8) var(--space-10)",
  borderRadius: "var(--radius-lg)",
  whiteSpace: "normal",
  textAlign: "center",
  fontWeight: 400,
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)", padding: "0 var(--space-2) var(--space-6)",
};

const GRID: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-6)", padding: "var(--space-2)",
};

// ---- Component ----

export function MiscToolsTab(props: MiscToolsTabProps) {
  const pinnedMiscItems = useContextPanelStore((s) => s.pinnedMiscItems);
  const togglePinMiscItem = useContextPanelStore((s) => s.togglePinMiscItem);
  const setActiveTab = useContextPanelStore((s) => s.setActiveTab);
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);

  const handleClick = useCallback(
    (tool: MiscTool) => {
      const fn = props[tool.actionKey];
      if (typeof fn === "function") (fn as () => void)();
    },
    [props],
  );

  // Renders a single tool card
  const renderCard = (tool: MiscTool) => {
    const isPinned = pinnedMiscItems.includes(tool.id);

    return (
      <div key={tool.id} className="misc-tool-card" style={{ position: "relative" }}>
        <button
          type="button"
          className="ui-btn"
          onClick={() => handleClick(tool)}
          style={CARD_STYLE}
        >
          <Icon icon={tool.icon} size={20} style={{ color: "var(--text-secondary)" }} />
          <span style={{ fontSize: "var(--fs-control)", lineHeight: 1.2, color: "var(--text-primary)" }}>
            {tool.label}
          </span>
        </button>

        {/* Pin toggle — revealed on hover / focus, always shown when pinned */}
        <IconButton
          icon={isPinned ? PinOff : Pin}
          label={isPinned ? "Unpin from header" : "Pin to header"}
          size="sm"
          active={isPinned}
          className="misc-tool-pin"
          onClick={() => togglePinMiscItem(tool.id)}
          style={{ position: "absolute", top: "var(--space-4)", right: "var(--space-4)" }}
        />
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
      <style>{CARD_CSS}</style>

      {/* Tools section */}
      <div>
        <div style={SECTION_LABEL}>Tools</div>
        <div style={GRID}>
          {MISC_TOOLS.map(renderCard)}
        </div>
      </div>

      {/* Quick actions section */}
      <div>
        <div style={SECTION_LABEL}>Quick actions</div>
        <div style={GRID}>
          {QUICK_ACTION_TOOLS.map(renderCard)}
        </div>
      </div>

      {/* AI generation — switches to the AI tab */}
      <div>
        <div style={SECTION_LABEL}>AI</div>
        <div style={GRID}>
          <button
            type="button"
            className="ui-btn"
            disabled={!aiEnabled}
            onClick={() => {
              if (!aiEnabled) return;
              // Determine current mode from store state (resolved to indices via selection.ts)
              let mode: string;
              if (getMultiSelectedLineIndices().length > 1) mode = "multi";
              else if (getSelectedEventIndices().length > 0) mode = "event";
              else if (getSelectedNoteIndices().length > 0) mode = "note";
              else if (getSelectedLineIndex() !== null) mode = "line";
              else mode = "global";
              setActiveTab(mode, "ai");
            }}
            style={CARD_STYLE}
          >
            <Icon icon={Sparkles} size={20} style={{ color: "var(--accent-primary)" }} />
            <span style={{ fontSize: "var(--fs-control)", lineHeight: 1.2, color: "var(--text-primary)" }}>
              AI generation
            </span>
            {!aiEnabled && (
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", lineHeight: 1.2 }}>
                Enable in settings
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
