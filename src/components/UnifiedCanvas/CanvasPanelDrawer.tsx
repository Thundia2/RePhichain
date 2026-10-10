// ============================================================
// Canvas Panel Drawer — Bottom panel area in unified canvas mode
//
// 3-tier panel system:
//   Tier 1 (always visible): Inspector sidebar, Keyframe bar
//   Tier 2 (quick-toggle):   Timeline, Lines, Effects — shown in tab bar
//   Tier 3 (on-demand):      All other panels — overlay with a "Back" button
//
// Supports popping out into a separate browser window.
// ============================================================

import { createPortal } from "react-dom";
import { ArrowLeft, PictureInPicture2, SquareArrowOutUpRight, X } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import type { PanelId } from "../../types/editor";
import { usePopoutWindow } from "../../hooks/usePopoutWindow";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { SegmentedControl } from "../common/SegmentedControl";

// Panel components
import { EffectsEditor } from "../EffectsEditor/EffectsEditor";
import { ValidationPanel } from "../Validation/ValidationPanel";
import { BpmListPanel } from "../BpmList/BpmList";
import { ChartSettings } from "../ChartSettings/ChartSettings";
import { TimelineSettings } from "../TimelineSettings/TimelineSettings";
import { GamePreview } from "../GamePreview/GamePreview";
import { Timeline } from "../Timeline/Timeline";
import { TexturePanel } from "../TexturePanel/TexturePanel";
import { GroupManager } from "../GroupManager/GroupManager";
import { LineList } from "../LineList/LineList";
import { PresetPanel } from "../PresetPanel/PresetPanel";
import { HotkeyReferencePanel } from "../HotkeyReference/HotkeyReferencePanel";

/** Quick-toggle panels shown as tabs in the drawer bar */
const QUICK_PANELS: { id: PanelId; label: string; hotkey: string }[] = [
  { id: "timeline", label: "Timeline", hotkey: "Alt+1" },
  { id: "line-list", label: "Lines", hotkey: "Alt+2" },
  { id: "effects", label: "Effects", hotkey: "Alt+3" },
];

/** Labels for on-demand (Tier 3) panels */
const ON_DEMAND_LABELS: Record<string, string> = {
  "textures": "Textures",
  "group-manager": "Groups",
  "bpm-list": "BPM list",
  "chart-settings": "Chart settings",
  "timeline-settings": "Timeline settings",
  "validation": "Validation",
  "game-preview": "Preview",
  "presets": "Presets",
  "hotkey-reference": "Hotkey reference",
};

function renderCanvasPanel(id: PanelId) {
  switch (id) {
    case "effects":
      return <EffectsEditor />;
    case "validation":
      return <ValidationPanel />;
    case "bpm-list":
      return <BpmListPanel />;
    case "chart-settings":
      return <ChartSettings />;
    case "timeline-settings":
      return <TimelineSettings />;
    case "textures":
      return <TexturePanel />;
    case "line-list":
      return <LineList />;
    case "group-manager":
      return <GroupManager />;
    case "game-preview":
      return <GamePreview />;
    case "timeline":
      return <Timeline />;
    case "presets":
      return <PresetPanel />;
    case "hotkey-reference":
      return <HotkeyReferencePanel />;
    default:
      return <div style={{ padding: "var(--space-12)", fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Panel not available</div>;
  }
}

export function CanvasPanelDrawer() {
  const activePanelId = useEditorStore((s) => s.canvasActivePanelId);
  const overlayPanelId = useEditorStore((s) => s.onDemandOverlayPanelId);
  const toggleCanvasPanel = useEditorStore((s) => s.toggleCanvasPanel);
  const setCanvasActivePanel = useEditorStore((s) => s.setCanvasActivePanel);
  const setOnDemandOverlay = useEditorStore((s) => s.setOnDemandOverlay);

  const effectivePanelId = overlayPanelId ?? activePanelId;

  const panelLabel = overlayPanelId
    ? (ON_DEMAND_LABELS[overlayPanelId] ?? overlayPanelId)
    : QUICK_PANELS.find((p) => p.id === activePanelId)?.label ?? "Panel";
  const { containerEl, openPopout, closePopout, isPopped } = usePopoutWindow(
    `Phichain — ${panelLabel}`,
  );

  if (!effectivePanelId) return null;

  // The panel content (tab bar + active panel)
  const panelContent = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--bg-secondary)",
        borderTop: isPopped ? "none" : "var(--rule) solid var(--border-color)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          height: 32,
          padding: "0 var(--space-4)",
          flexShrink: 0,
          background: "var(--bg-primary)",
          borderBottom: "var(--rule) solid var(--border-color)",
          overflow: "hidden",
        }}
      >
        {overlayPanelId ? (
          /* On-demand overlay: show "Back" + panel title */
          <>
            <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => setOnDemandOverlay(null)}>
              Back
            </Button>
            <span style={{
              fontSize: "var(--fs-control)", fontWeight: 600,
              color: "var(--text-primary)", padding: "0 var(--space-4)", flex: 1,
            }}>
              {ON_DEMAND_LABELS[overlayPanelId] ?? overlayPanelId}
            </span>
          </>
        ) : (
          /* Quick-toggle tabs (Tier 2) — clicking the active tab closes it */
          <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
            <SegmentedControl
              role="tablist"
              label="Panels"
              size="sm"
              value={activePanelId}
              onChange={(id) => toggleCanvasPanel(id)}
              options={QUICK_PANELS.map((panel) => ({
                value: panel.id,
                label: panel.label,
                title: `${panel.label} (${panel.hotkey})`,
              }))}
            />
          </div>
        )}

        {/* Pop out / Pop in button */}
        <IconButton
          icon={isPopped ? PictureInPicture2 : SquareArrowOutUpRight}
          label={isPopped ? "Pop back in" : "Pop out to window"}
          size="md"
          active={isPopped || undefined}
          tooltipPosition="left"
          onClick={isPopped ? closePopout : openPopout}
        />

        {/* Close button */}
        <IconButton
          icon={X}
          label="Close panel"
          size="md"
          tooltipPosition="left"
          onClick={() => {
            closePopout();
            setOnDemandOverlay(null);
            setCanvasActivePanel(null);
          }}
        />
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {renderCanvasPanel(effectivePanelId)}
      </div>
    </div>
  );

  // If popped out, render via portal into the external window
  if (isPopped && containerEl) {
    return createPortal(panelContent, containerEl);
  }

  return panelContent;
}
