// ============================================================
// Interactive Editor Guide Modal — Thin Orchestrator
//
// A tab-based, animation-rich beginner's guide to the PhiChain
// editor. Content is split across sibling files:
//   guideData.ts        — pure data constants + easing math
//   guideComponents.tsx  — shared UI atoms (GCard, STitle, ColorDot)
//   guideAnimations.tsx  — interactive SVG animations
//   guideTabs.tsx        — per-tab content components
//
// This file is just the modal shell: the shared Dialog chrome
// (title, close, Esc), a sentence-case tab list, tab routing and
// footer navigation.
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Check, BookOpen } from "lucide-react";
import { TABS } from "./guideData";
import {
  WelcomeTab, CanvasTab, NotesTab, EventsTab, EasingsTab,
  ToolsTab, PanelsTab, ShortcutsTab, AdvancedTab, TipsTab,
} from "./guideTabs";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";

// ---- Props ----

interface EditorGuideModalProps {
  open: boolean;
  onClose: () => void;
}

// ---- Main Export ----

export function EditorGuideModal({ open, onClose }: EditorGuideModalProps) {
  const [activeTab, setActiveTab] = useState("welcome");
  const contentRef = useRef<HTMLDivElement>(null);

  // Reset scroll on tab change
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeTab]);

  // Reset to welcome on open
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setActiveTab("welcome");
  }, [open]);

  const tabIndex = TABS.findIndex(t => t.id === activeTab);
  const isLastTab = tabIndex === TABS.length - 1;

  const goNext = useCallback(() => {
    if (isLastTab) { onClose(); return; }
    setActiveTab(TABS[tabIndex + 1].id);
  }, [tabIndex, isLastTab, onClose]);

  if (!open) return null;

  return (
    <Dialog
      title="Editor guide"
      icon={BookOpen}
      onClose={onClose}
      width={760}
      height="82vh"
      headerExtra={
        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          {tabIndex + 1} of {TABS.length}
        </span>
      }
      bodyStyle={{
        padding: 0, display: "flex", overflow: "hidden",
        borderTop: "var(--rule) solid var(--separator)",
      }}
      footer={
        <>
          {/* Pagination dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", marginRight: "auto" }}>
            {TABS.map((tab, i) => (
              <Tooltip key={tab.id} content={tab.label}>
                <button
                  type="button"
                  aria-label={`Go to ${tab.label}`}
                  aria-current={i === tabIndex ? "step" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    width: 8, height: 8, borderRadius: "var(--radius-full)", border: "none", cursor: "pointer", padding: 0,
                    background: i <= tabIndex ? "var(--accent-primary)" : "var(--fill-strong)",
                    opacity: i < tabIndex ? 0.4 : 1,
                    transition: "background-color var(--dur-base)",
                  }}
                />
              </Tooltip>
            ))}
          </div>
          {/* Next / Done */}
          <Button variant="primary" onClick={goNext}>
            {isLastTab ? "Done" : <>Next<Icon icon={ArrowRight} size={14} /></>}
          </Button>
        </>
      }
    >
      {/* Tab list */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Guide sections"
        style={{
          width: 168, flexShrink: 0,
          borderRight: "var(--rule) solid var(--separator)",
          overflowY: "auto", padding: "var(--space-8)",
          display: "flex", flexDirection: "column", gap: "var(--space-2)",
        }}
      >
        {TABS.map((tab, i) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? undefined : "ui-hover"}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-8)",
                width: "100%", minHeight: "var(--control-lg)", padding: "0 var(--space-8)",
                border: "none", borderRadius: "var(--radius-md)",
                // Unselected tabs take their hover wash from .ui-hover (no inline background).
                background: selected ? "var(--accent-selected)" : undefined,
                color: selected ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer", fontSize: "var(--fs-control)", fontWeight: selected ? 500 : 400,
                fontFamily: "inherit", textAlign: "left",
              }}
            >
              <Icon icon={tab.icon} size={14} style={{ color: selected ? "var(--accent-primary)" : undefined }} />
              <span style={{ flex: 1, minWidth: 0 }}>{tab.label}</span>
              {i < tabIndex && (
                <Icon icon={Check} size={12} style={{ color: "var(--text-muted)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        role="tabpanel"
        aria-label={TABS[tabIndex]?.label}
        style={{ flex: 1, overflowY: "auto", padding: "var(--space-16) var(--space-20) var(--space-20)" }}
      >
        {activeTab === "welcome" && <WelcomeTab />}
        {activeTab === "canvas" && <CanvasTab active={activeTab === "canvas"} />}
        {activeTab === "notes" && <NotesTab active={activeTab === "notes"} />}
        {activeTab === "events" && <EventsTab active={activeTab === "events"} />}
        {activeTab === "easings" && <EasingsTab active={activeTab === "easings"} />}
        {activeTab === "tools" && <ToolsTab />}
        {activeTab === "panels" && <PanelsTab />}
        {activeTab === "shortcuts" && <ShortcutsTab />}
        {activeTab === "advanced" && <AdvancedTab />}
        {activeTab === "tips" && <TipsTab />}
      </div>
    </Dialog>
  );
}
