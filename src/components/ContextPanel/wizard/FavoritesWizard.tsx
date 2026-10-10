// ============================================================
// Favorites Wizard — First-open setup for easing, preset, and
// shader favorites. Reopenable from command palette. Rendered in
// the shared Dialog chrome with a segmented step switcher.
// ============================================================

import { useState } from "react";
import { Star } from "lucide-react";
import { Dialog } from "../../common/Dialog";
import { Button } from "../../common/Button";
import { SegmentedControl } from "../../common/SegmentedControl";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { EasingStepGrid } from "./EasingStepGrid";
import { PresetStepList } from "./PresetStepList";
import { ShaderStepPlaceholder } from "./ShaderStepPlaceholder";

const STEPS = ["Easings", "Presets", "Shaders"];

export function FavoritesWizard() {
  const showWizard = useFavoritesStore((s) => s.showFavoritesWizard);
  const closeWizard = useFavoritesStore((s) => s.closeWizard);
  const completeSetup = useFavoritesStore((s) => s.completeSetup);

  const [step, setStep] = useState(0);

  if (!showWizard) return null;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeSetup();
      setStep(0);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    completeSetup();
    setStep(0);
  };

  // I8: reset to the first step on close. The component stays mounted (it returns null
  // when hidden), so without this a reopen would resume on whatever step was last viewed.
  const handleClose = () => {
    setStep(0);
    closeWizard();
  };

  return (
    <Dialog
      title="Configure favorites"
      icon={Star}
      onClose={handleClose}
      width={520}
      height="80vh"
      bodyStyle={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
      footer={
        <>
          <Button variant="ghost" onClick={handleSkip} style={{ marginRight: "auto" }}>
            Skip for now
          </Button>
          {step > 0 && <Button onClick={handleBack}>Back</Button>}
          <Button variant="primary" onClick={handleNext}>
            {step === STEPS.length - 1 ? "Done" : "Next"}
          </Button>
        </>
      }
    >
      {/* Subtitle + step switcher */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
        <div style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          Pick your most-used items for quick access
        </div>
        <SegmentedControl
          label="Favorites wizard steps"
          role="tablist"
          options={STEPS.map((s, i) => ({ value: i, label: `${i + 1}. ${s}` }))}
          value={step}
          onChange={setStep}
        />
      </div>

      {/* Content */}
      <div>
        {step === 0 && <EasingStepGrid />}
        {step === 1 && <PresetStepList />}
        {step === 2 && <ShaderStepPlaceholder />}
      </div>
    </Dialog>
  );
}
