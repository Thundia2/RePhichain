// ============================================================
// Onboarding Overlay
//
// First-run experience that introduces new users to the editor.
// Shows 5 steps highlighting key areas of the UI, on a popover
// surface above the overlay scrim.
// ============================================================

import { useState, useCallback, useId, type ReactNode } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { Button } from "../common/Button";
import { ActionKbd, Kbd } from "../common/Kbd";

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Welcome to PhiChain",
    body: "PhiChain is a chart editor for the rhythm game Phigros. Create judgment lines, place notes, and animate line events to build playable charts.",
  },
  {
    title: "Toolbar",
    body: (
      <>
        Use the toolbar on the left to switch between tools: Select <ActionKbd action="select_tool" />,
        Tap <ActionKbd action="place_tap" />, Drag <ActionKbd action="place_drag" />, Flick <ActionKbd action="place_flick" />,
        Hold <ActionKbd action="place_hold" />, and Eraser <ActionKbd action="eraser_tool" />. Each tool changes how clicks on the timeline behave.
      </>
    ),
  },
  {
    title: "Timeline",
    body: "The timeline is your main editing workspace. Scroll to navigate through beats, click to place notes, and drag to select. The beat grid snaps notes to the current density.",
  },
  {
    title: "Inspector",
    body: "When you select a note or event, the Inspector shows its properties. Edit beat positions, X coordinates, speed, and easing curves directly.",
  },
  {
    title: "Keyboard shortcuts",
    body: (
      <>
        Press <Kbd>Ctrl+K</Kbd> to open the command palette. Use <ActionKbd action="toggle_playback" /> for play/pause,{" "}
        <ActionKbd action="undo" /> / <ActionKbd action="redo" /> for undo/redo, and the arrow keys to nudge selected items.
      </>
    ),
  },
];

export function OnboardingOverlay() {
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const [visible, setVisible] = useState(true);
  const titleId = useId();

  const handleDismiss = useCallback(() => {
    if (dontShowAgain) {
      updateSettings({ hasSeenOnboarding: true });
    } else {
      // Just close without persisting — will show again next launch
      setVisible(false);
    }
  }, [dontShowAgain, updateSettings]);

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  }, [currentStep, handleDismiss]);

  const handleSkip = useCallback(() => {
    handleDismiss();
  }, [handleDismiss]);

  if (hasSeenOnboarding || !visible) return null;

  const step = STEPS[currentStep];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-dropdown)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--overlay)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ui-popover"
        style={{
          width: "100%",
          maxWidth: 448,
          margin: "0 var(--space-16)",
          padding: "var(--space-24)",
          color: "var(--text-primary)",
        }}
      >
        {/* Step indicator */}
        <div style={{ display: "flex", gap: "var(--space-6)", marginBottom: "var(--space-16)", justifyContent: "center" }}>
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx === currentStep ? 20 : 8,
                height: 8,
                borderRadius: "var(--radius-full)",
                transition: "width var(--dur-base) var(--ease-out), background-color var(--dur-base)",
                backgroundColor: idx <= currentStep ? "var(--accent-primary)" : "var(--fill-strong)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <h2
          id={titleId}
          style={{
            fontSize: "var(--fs-title)",
            lineHeight: "20px",
            fontWeight: 600,
            textAlign: "center",
            marginBottom: "var(--space-8)",
          }}
        >
          {step.title}
        </h2>
        <p
          style={{
            fontSize: "var(--fs-body)",
            lineHeight: "20px",
            textAlign: "center",
            color: "var(--text-secondary)",
            marginBottom: "var(--space-24)",
          }}
        >
          {step.body}
        </p>

        {/* Step counter */}
        <div
          style={{
            fontSize: "var(--fs-caption)",
            textAlign: "center",
            color: "var(--text-secondary)",
            marginBottom: "var(--space-16)",
          }}
        >
          Step {currentStep + 1} of {STEPS.length}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-8)" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-6)",
              fontSize: "var(--fs-caption)",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ accentColor: "var(--accent-primary)" }}
            />
            Don't show again
          </label>

          <div style={{ display: "flex", gap: "var(--space-8)" }}>
            <Button variant="ghost" onClick={handleSkip}>
              Skip
            </Button>
            <Button variant="primary" onClick={handleNext}>
              {currentStep < STEPS.length - 1 ? "Next" : "Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
