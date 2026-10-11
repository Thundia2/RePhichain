// ============================================================
// ContextPanelSidebar — Wrapper with collapsed / popped-out states
//
// Three visual states:
// 1. Collapsed  — rail-width strip with one "open panel" button
// 2. Popped out — rail-width strip with one "bring back" button;
//                 the panel renders via portal
// 3. Normal     — 290px inline panel
//
// Pop-out uses usePopoutWindow to open a separate browser window
// and createPortal to render ContextPanel inside it.
// ============================================================

import type React from "react";
import { createPortal } from "react-dom";
import { useCallback, useEffect } from "react";
import { useContextPanelStore } from "../../stores/contextPanelStore";
import { usePopoutWindow } from "../../hooks/usePopoutWindow";
import { PanelRightOpen, PanelRightDashed } from "lucide-react";
import { ContextPanel } from "./ContextPanel";
import type { ContextPanelProps } from "./ContextPanel";
import { IconButton } from "../common/IconButton";

const PANEL_WIDTH = "var(--panel-width)";

/** Collapsed / popped-out strip: one IconButton at the top of a rail-width column. */
function RailStrip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "var(--rail-width)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "var(--space-8)",
        background: "var(--bg-secondary)",
        borderLeft: "var(--rule) solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

export function ContextPanelSidebar(props: ContextPanelProps) {
  const collapsed = useContextPanelStore((s) => s.collapsed);
  const poppedOut = useContextPanelStore((s) => s.poppedOut);
  const setCollapsed = useContextPanelStore((s) => s.setCollapsed);
  const setPoppedOut = useContextPanelStore((s) => s.setPoppedOut);

  const {
    containerEl,
    isPopped,
    openPopout,
    closePopout,
  } = usePopoutWindow("Context Panel", {
    width: 320,
    height: 600,
    windowName: "phichain-context-panel",
  });

  // Sync popout hook state -> store
  useEffect(() => {
    setPoppedOut(isPopped);
  }, [isPopped, setPoppedOut]);

  // When popout window is closed externally, reset store
  useEffect(() => {
    if (!isPopped && poppedOut) {
      setPoppedOut(false);
    }
  }, [isPopped, poppedOut, setPoppedOut]);

  // ---- Handlers ----

  const handlePopout = useCallback(() => {
    if (isPopped) {
      // Already popped -- bring back inline
      closePopout();
      setPoppedOut(false);
      setCollapsed(false);
    } else {
      openPopout();
      setPoppedOut(true);
    }
  }, [isPopped, openPopout, closePopout, setPoppedOut, setCollapsed]);

  const handleCollapse = useCallback(() => {
    if (isPopped) {
      closePopout();
      setPoppedOut(false);
    }
    setCollapsed(true);
  }, [isPopped, closePopout, setPoppedOut, setCollapsed]);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
  }, [setCollapsed]);

  const handleBringBack = useCallback(() => {
    closePopout();
    setPoppedOut(false);
    setCollapsed(false);
  }, [closePopout, setPoppedOut, setCollapsed]);

  // ---- Build the panel element (shared between inline and portal) ----

  const panelElement = (
    <ContextPanel
      {...props}
      onPopout={handlePopout}
      onCollapse={handleCollapse}
    />
  );

  // ---- State: Popped out ----

  if (poppedOut) {
    return (
      <>
        <RailStrip>
          <IconButton icon={PanelRightDashed} label="Panel is in its own window. Bring it back" tooltipPosition="left" active onClick={handleBringBack} />
        </RailStrip>

        {/* Render into popout window via portal */}
        {containerEl && createPortal(panelElement, containerEl)}
      </>
    );
  }

  // ---- State: Collapsed ----

  if (collapsed) {
    return (
      <RailStrip>
        <IconButton icon={PanelRightOpen} label="Open context panel" tooltipPosition="left" onClick={handleExpand} />
      </RailStrip>
    );
  }

  // ---- State: Normal (expanded inline) ----

  return (
    <div
      style={{
        width: PANEL_WIDTH,
        flexShrink: 0,
        borderLeft: "var(--rule) solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {panelElement}
    </div>
  );
}
