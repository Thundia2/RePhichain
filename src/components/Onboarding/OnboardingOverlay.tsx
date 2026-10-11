// ============================================================
// Onboarding Overlay — first-run welcome tour
//
// Opens once, the first time an editor tab shows a loaded chart
// (App.tsx), and walks through the unified editor's regions in six
// short steps on the shared Dialog chrome. Closing it any way (Done,
// Skip tour, Esc, backdrop) records hasSeenOnboarding so it doesn't
// return; View → Welcome tour (also in the command palette) reopens it.
// ← / → step through while it is open.
// ============================================================

import { useState, useEffect, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { ActionKbd, Kbd } from "../common/Kbd";

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Welcome to PhiChain",
    body: (
      <>
        PhiChain is a chart editor for the rhythm game Phigros. Charts are built from judgment lines: you place notes
        on them and animate them with events. This tour shows where everything lives.
      </>
    ),
  },
  {
    title: "Tools",
    body: (
      <>
        The rail on the left switches tools: Select <ActionKbd action="select_tool" />, Tap{" "}
        <ActionKbd action="place_tap" />, Drag <ActionKbd action="place_drag" />, Flick <ActionKbd action="place_flick" />,
        Hold <ActionKbd action="place_hold" /> and Eraser <ActionKbd action="eraser_tool" />. Hover a tool to see its name
        and shortcut.
      </>
    ),
  },
  {
    title: "Lines and canvas",
    body: (
      <>
        Pick the line you are editing from the strip above the canvas, or press <Kbd>L</Kbd> for the full line list. On
        the canvas, click with a note tool to place a note on that line, or use Select to pick and drag notes and lines.
      </>
    ),
  },
  {
    title: "Playback and keyframes",
    body: (
      <>
        The transport under the canvas plays and scrubs the song. The keyframe bar below holds the selected line's
        events: double-click a lane to add one, right-click one to change its easing.
      </>
    ),
  },
  {
    title: "Context panel and inspector",
    body: (
      <>
        The panel on the right follows your selection, showing chart tools or the actions for a line, note or event.
        Press <Kbd>I</Kbd> for the inspector, where you edit the selected item's values.
      </>
    ),
  },
  {
    title: "Shortcuts",
    body: (
      <>
        Press <Kbd>Ctrl+K</Kbd> to search every command. <ActionKbd action="toggle_playback" /> plays and pauses,{" "}
        <ActionKbd action="undo" /> and <ActionKbd action="redo" /> undo and redo. The View menu has the hotkey reference
        for the rest, and this tour.
      </>
    ),
  },
];

export function OnboardingOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <OnboardingTour onClose={onClose} />;
}

/** Mounted only while open, so every opening starts at step 1. */
function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, last));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
      else return;
      // Keep the arrows from nudging the selection behind the tour.
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [last]);

  const { title, body } = STEPS[step];

  return (
    <Dialog
      title="Welcome tour"
      icon={Sparkles}
      iconColor="var(--accent-primary)"
      onClose={onClose}
      width={440}
      closeOnBackdrop={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} style={{ marginRight: "auto" }}>
            Skip tour
          </Button>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          <Button
            variant="primary"
            data-autofocus
            onClick={() => (step < last ? setStep(step + 1) : onClose())}
          >
            {step < last ? "Next" : "Done"}
          </Button>
        </>
      }
    >
      <div
        role="group"
        aria-roledescription="step"
        aria-label={`Step ${step + 1} of ${STEPS.length}`}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}
      >
        <div
          aria-hidden="true"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", marginBottom: "var(--space-4)" }}
        >
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: "var(--radius-full)",
                backgroundColor: i <= step ? "var(--accent-primary)" : "var(--fill-strong)",
                transition: "width var(--dur-base) var(--ease-out), background-color var(--dur-base)",
              }}
            />
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontSize: "var(--fs-caption)",
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {step + 1} of {STEPS.length}
          </span>
        </div>
        <h3 style={{ fontSize: "var(--fs-headline)", lineHeight: "20px", fontWeight: 600, color: "var(--text-primary)" }}>
          {title}
        </h3>
        {/* Room for the longest step (three lines), so the dialog doesn't jump between steps. */}
        <p
          aria-live="polite"
          style={{ minHeight: 60, fontSize: "var(--fs-body)", lineHeight: "20px", color: "var(--text-secondary)" }}
        >
          {body}
        </p>
      </div>
    </Dialog>
  );
}
