// ============================================================
// Parametric Trajectory Dialog
//
// Modal dialog for generating line movement events from
// parametric sin/cos equations. Sectioned card layout inside
// the shared Dialog chrome.
// ============================================================

import { useState } from "react";
import { Waves } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { getSelectedLineIndex } from "../../stores/selection";
import type { LineEventKind } from "../../types/chart";
import { generateParametricEvents, type ParametricConfig } from "../../utils/parametricTrajectory";
import { safeParseNumber, NumericInput } from "../common/FormFields";
import { Card, CardRow, SectionHeader, INPUT_STYLE } from "../common/UIKit";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";

interface ParametricDialogProps {
  open: boolean;
  onClose: () => void;
}

/* ── Reusable sub-components ── */

const FIELD_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  width: "100%",
};

const NUM_STYLE: React.CSSProperties = {
  ...FIELD_STYLE,
  fontFamily: "var(--font-mono)",
};

/** Card row with a fixed-width control column. */
function ControlRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <CardRow label={label} last={last}>
      <div style={{ width: 130 }}>{children}</div>
    </CardRow>
  );
}

function CardRowWide({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "var(--space-10) var(--space-12)",
        borderBottom: last ? "none" : "var(--rule) solid var(--separator)",
      }}
    >
      <label style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", display: "block", marginBottom: "var(--space-4)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Main Dialog ── */

export function ParametricDialog({ open, onClose }: ParametricDialogProps) {
  const [kind, setKind] = useState<LineEventKind>("x");
  const [startBeat, setStartBeat] = useState(0);
  const [endBeat, setEndBeat] = useState(16);
  const [steps, setSteps] = useState(32);
  const [amplitude, setAmplitude] = useState(200);
  const [frequency, setFrequency] = useState(1);
  const [phase, setPhase] = useState(0);
  const [offset, setOffset] = useState(0);
  const [waveform, setWaveform] = useState<"sin" | "cos">("sin");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = () => {
    const cs = useChartStore.getState();
    const selectedLineIndex = getSelectedLineIndex();

    if (selectedLineIndex === null) {
      setError("Please select a line first.");
      return;
    }

    const config: ParametricConfig = {
      kind, startBeat, endBeat, steps, amplitude, frequency, phase, offset, waveform,
    };

    const events = generateParametricEvents(config);
    if (events.length === 0) {
      setError("No events generated. Check start/end beats and steps.");
      return;
    }

    // One undo entry (finding L1) + route flat<->layer (finding L3) so generated
    // events land where the evaluator reads on a layered (RPE-imported) line.
    cs.transaction(() => {
      for (const event of events) {
        cs.addEventRouted(selectedLineIndex, event);
      }
    });

    setError(null);
    onClose();
  };

  return (
    <Dialog
      title="Parametric trajectory"
      icon={Waves}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGenerate}>Generate</Button>
        </>
      }
    >
      {/* WAVE PARAMETERS */}
      <div style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeader>Wave parameters</SectionHeader>
        <Card style={{ marginBottom: 0 }}>
          <CardRowWide label="Event kind">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as LineEventKind)}
              style={{ ...FIELD_STYLE, cursor: "pointer" }}
            >
              <option value="x">X position</option>
              <option value="y">Y position</option>
              <option value="rotation">Rotation</option>
              <option value="opacity">Opacity</option>
              <option value="scale_x">Scale X</option>
              <option value="scale_y">Scale Y</option>
            </select>
          </CardRowWide>
          <ControlRow label="Waveform">
            <select
              value={waveform}
              onChange={(e) => setWaveform(e.target.value as "sin" | "cos")}
              style={{ ...FIELD_STYLE, cursor: "pointer" }}
            >
              <option value="sin">sin</option>
              <option value="cos">cos</option>
            </select>
          </ControlRow>
          <ControlRow label="Amplitude">
            <input
              type="number"
              step="1"
              value={amplitude}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setAmplitude(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
          <ControlRow label="Frequency">
            <input
              type="number"
              step="0.1"
              value={frequency}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setFrequency(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
          <ControlRow label="Phase (rad)">
            <input
              type="number"
              step="0.1"
              value={phase}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setPhase(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
          <ControlRow label="Offset" last>
            <input
              type="number"
              step="1"
              value={offset}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setOffset(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
        </Card>
      </div>

      {/* RANGE */}
      <div style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeader>Range</SectionHeader>
        <Card style={{ marginBottom: 0 }}>
          <ControlRow label="Start beat">
            <input
              type="number"
              step="0.25"
              value={startBeat}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setStartBeat(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
          <ControlRow label="End beat">
            <input
              type="number"
              step="0.25"
              value={endBeat}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setEndBeat(n); }}
              style={NUM_STYLE}
            />
          </ControlRow>
          <ControlRow label="Steps" last>
            <NumericInput
              commitMode="blur"
              integer
              min={1}
              max={1000}
              fallback={1}
              value={steps}
              onChange={setSteps}
              style={NUM_STYLE}
            />
          </ControlRow>
        </Card>
      </div>

      {/* Formula preview */}
      <div
        style={{
          padding: "var(--space-10) var(--space-12)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-active)",
          fontSize: "var(--fs-control)",
          color: "var(--text-primary)",
          lineHeight: "1.5",
          fontFamily: "var(--font-mono)",
        }}
      >
        <div>{kind}(t) = {amplitude} * {waveform}({frequency} * t * 2π + {phase}) + {offset}</div>
        <div style={{ color: "var(--text-secondary)", marginTop: "var(--space-2)", fontFamily: "var(--font-sans)" }}>
          Generates {steps} transition events from beat {startBeat} to {endBeat}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "var(--space-12)",
            padding: "var(--space-8) var(--space-12)",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--fs-body)",
            color: "var(--error)",
            backgroundColor: "color-mix(in srgb, var(--error) 10%, transparent)",
          }}
        >
          {error}
        </div>
      )}
    </Dialog>
  );
}
