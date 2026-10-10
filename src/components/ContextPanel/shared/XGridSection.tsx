// ============================================================
// XGridSection — Shared X-axis grid/snap control panel
//
// Used by both LineMode and GlobalMode in the ContextPanel.
// Replaces the duplicated X SNAP sections with a unified UI in the
// PhiChain design system: a filled bg-active block (no border),
// the UIKit Toggle and an accent SegmentedControl.
//
// Features:
//   - Toggle (visibility + snap coupled, RPE parity)
//   - Preset segments [11, 21, 31, 17] (real-world charter values)
//   - Arbitrary N input (2..256)
//   - Spacing readout + even-N warning status line
//
// Recent change: Created as part of X grid system rewrite.
// Replaces lanes→verticalLines convention, fixes center-line bug.
// ============================================================

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEditorStore } from "../../../stores/editorStore";
import { getXSpacing, hasCenterLine } from "../../../utils/xSnap";
import { NumericInput } from "../../common/FormFields";
import { Toggle, INPUT_STYLE } from "../../common/UIKit";
import { SegmentedControl } from "../../common/SegmentedControl";
import { Icon } from "../../common/Icon";

// ---- Tunables ----

const N_PRESETS = [11, 21, 31, 17] as const;
const MAX_VERTICAL_LINES = 256;

// ---- Component ----

export function XGridSection() {
  const verticalLines = useEditorStore((s) => s.verticalLines);
  const xSnapEnabled = useEditorStore((s) => s.xSnapEnabled);
  const setVerticalLines = useEditorStore((s) => s.setVerticalLines);
  const toggleXSnap = useEditorStore((s) => s.toggleXSnap);

  const spacing = getXSpacing(verticalLines);
  const spacingDisplay = spacing % 1 === 0 ? spacing.toFixed(0) : spacing.toFixed(2);
  const hasCenter = hasCenterLine(verticalLines);
  const presetValue = (N_PRESETS as readonly number[]).includes(verticalLines) ? verticalLines : null;

  return (
    <div style={{
      background: "var(--bg-active)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-10) var(--space-12)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
    }}>
      {/* Row 1: label + spacing readout + toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
        <span style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)", fontWeight: 600, flex: 1 }}>
          X grid
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-caption)",
          color: "var(--text-secondary)",
        }}>
          {verticalLines} lines · {spacingDisplay}
        </span>
        <Toggle checked={xSnapEnabled} onChange={() => toggleXSnap()} label="X grid snap" />
      </div>

      {/* Row 2: preset segments + arbitrary N input */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <SegmentedControl
          label="Grid line presets"
          tone="accent"
          size="sm"
          options={N_PRESETS.map((n) => ({ value: n, label: <span style={{ fontFamily: "var(--font-mono)" }}>{n}</span> }))}
          value={presetValue}
          onChange={(n) => {
            setVerticalLines(n);
            if (!xSnapEnabled) toggleXSnap();
          }}
        />

        <NumericInput
          commitMode="blur"
          integer
          min={2}
          max={MAX_VERTICAL_LINES}
          value={verticalLines}
          onChange={setVerticalLines}
          title="Vertical grid lines (2–256)"
          style={{
            ...INPUT_STYLE,
            width: 48,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fs-caption)",
            textAlign: "center",
            marginLeft: "auto",
          }}
        />
      </div>

      {/* Status line — center line warning */}
      <div style={{
        fontSize: "var(--fs-caption)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        color: hasCenter ? "var(--success)" : "var(--warning)",
      }}>
        <Icon icon={hasCenter ? CircleCheck : TriangleAlert} size={12} />
        <span>
          {hasCenter
            ? "N is odd — center line at X=0 is snappable"
            : "N is even — no snap point at X=0"}
        </span>
      </div>
    </div>
  );
}
