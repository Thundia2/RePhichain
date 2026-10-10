// ============================================================
// Spin Generator Dialog
//
// Takes rotation count + direction + starting angle and generates
// the correct rotation event, eliminating mental math.
// Rendered in the shared Dialog chrome.
// ============================================================

import { useState, useCallback } from "react";
import { RotateCw, RotateCcw } from "lucide-react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { SegmentedControl } from "../common/SegmentedControl";
import { Field, safeParseNumber } from "../common/FormFields";
import { EasingPicker } from "../common/EasingPicker";
import { generateSpinEvent } from "../../utils/spinGenerator";
import { useChartStore } from "../../stores/chartStore";
import { useSelectedLineIndex } from "../../stores/selection";
import type { SpinConfig } from "../../utils/spinGenerator";
import type { EasingType } from "../../types/chart";

export function SpinGeneratorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectedLineIndex = useSelectedLineIndex();
  const addEvent = useChartStore((s) => s.addEvent);

  const [config, setConfig] = useState<SpinConfig>({
    startBeat: 0,
    endBeat: 8,
    rotations: 2,
    clockwise: true,
    startAngle: 0,
    easing: "linear",
  });

  const endAngle = config.startAngle + config.rotations * 360 * (config.clockwise ? 1 : -1);

  const update = useCallback((changes: Partial<SpinConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleGenerate = useCallback(() => {
    if (selectedLineIndex === null) return;
    const event = generateSpinEvent(config);
    addEvent(selectedLineIndex, event);
    onClose();
  }, [selectedLineIndex, config, addEvent, onClose]);

  if (!open) return null;

  return (
    <Dialog
      title="Spin generator"
      icon={RotateCw}
      onClose={onClose}
      width={360}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGenerate} disabled={selectedLineIndex === null}>
            Generate
          </Button>
        </>
      }
    >
      {selectedLineIndex === null && (
        <div style={{ color: "var(--error)", fontSize: "var(--fs-control)", marginBottom: "var(--space-8)" }}>
          Select a line first
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
          <Field label="Start beat" value={config.startBeat} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ startBeat: n });
          }} step="0.25" />
          <Field label="End beat" value={config.endBeat} onChange={(v) => {
            const n = safeParseNumber(v); if (n !== null) update({ endBeat: n });
          }} step="0.25" />
        </div>

        <Field label="Rotations" value={config.rotations} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ rotations: Math.max(0, n) });
        }} step="0.5" />

        <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", width: 64, textAlign: "right", flexShrink: 0 }}>Direction</span>
          <SegmentedControl
            label="Direction"
            tone="accent"
            size="sm"
            value={config.clockwise ? "cw" : "ccw"}
            onChange={(v) => update({ clockwise: v === "cw" })}
            options={[
              { value: "cw", label: "Clockwise", icon: RotateCw },
              { value: "ccw", label: "Counterclockwise", icon: RotateCcw },
            ]}
          />
        </div>

        <Field label="Start angle" value={config.startAngle} onChange={(v) => {
          const n = safeParseNumber(v); if (n !== null) update({ startAngle: n });
        }} step="1" />

        <Field label="End angle" value={Math.round(endAngle * 100) / 100} onChange={() => {}} disabled />

        <EasingPicker value={typeof config.easing === "string" ? config.easing : "linear"} onChange={(v) => update({ easing: v as EasingType })} />
      </div>
    </Dialog>
  );
}
