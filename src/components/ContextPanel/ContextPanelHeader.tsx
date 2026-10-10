// ============================================================
// ContextPanelHeader — Title bar + pinned items strip
//
// Renders the mode-aware header row with pop-out / collapse
// controls and an optional row of pinned misc-tool shortcuts.
// ============================================================

import { ClipboardPaste, FileDiff, LocateFixed, Mic, Package, PanelRightClose, ExternalLink, Tornado, Vibrate, Wrench, type LucideIcon } from "lucide-react";
import { useContextPanelStore } from "../../stores/contextPanelStore";
import type { ContextPanelMode } from "../../hooks/useContextPanelMode";
import { MODE_CONFIG } from "../../hooks/useContextPanelMode";
import { IconButton } from "../common/IconButton";

const MISC_TOOLS: Record<string, { icon: LucideIcon; label: string }> = {
  "paste-special": { icon: ClipboardPaste, label: "Paste special…" },
  "record-review": { icon: Mic, label: "Review recording…" },
  "export-diff": { icon: FileDiff, label: "Export diff…" },
  "selective-export": { icon: Package, label: "Selective export…" },
  "go-to-beat": { icon: LocateFixed, label: "Go to beat…" },
  // I1: spin-generator + shake-generator are in MISC_ACTION_MAP (ContextPanel) but were
  // missing here, so pinning either rendered the "?" placeholder.
  "spin-generator": { icon: Tornado, label: "Spin generator…" },
  "shake-generator": { icon: Vibrate, label: "Shake generator…" },
};

export function ContextPanelHeader({
  mode,
  modeDetail,
  onPopout,
  onCollapse,
  onPinnedItemClick,
}: {
  mode: ContextPanelMode;
  modeDetail?: string;
  onPopout: () => void;
  onCollapse: () => void;
  onPinnedItemClick: (itemId: string) => void;
}) {
  const pinnedItems = useContextPanelStore((s) => s.pinnedMiscItems);
  const config = MODE_CONFIG[mode];

  return (
    <>
      {/* Title bar */}
      <div
        style={{
          height: "var(--panel-header-height)",
          display: "flex",
          alignItems: "center",
          padding: "0 var(--space-6) 0 var(--space-12)",
          gap: "var(--space-2)",
          borderBottom: "var(--rule) solid var(--border-color)",
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--fs-headline)",
            lineHeight: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {config.label}
          {modeDetail && (
            <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
              {" · "}
              {modeDetail}
            </span>
          )}
        </h2>

        <IconButton icon={ExternalLink} label="Pop out to window" size="md" tooltipPosition="bottom" onClick={onPopout} />
        <IconButton icon={PanelRightClose} label="Collapse panel" size="md" tooltipPosition="bottom" onClick={onCollapse} />
      </div>

      {/* Pinned tools (only shown when there are pinned items) */}
      {pinnedItems.length > 0 && (
        <div
          role="toolbar"
          aria-label="Pinned tools"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-4) var(--space-8)",
            borderBottom: "var(--rule) solid var(--border-color)",
            flexShrink: 0,
          }}
        >
          {pinnedItems.map((itemId) => {
            const tool = MISC_TOOLS[itemId] ?? { icon: Wrench, label: itemId.replace(/-/g, " ") };
            return (
              <IconButton
                key={itemId}
                icon={tool.icon}
                label={tool.label}
                size="md"
                tooltipPosition="bottom"
                onClick={() => onPinnedItemClick(itemId)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
