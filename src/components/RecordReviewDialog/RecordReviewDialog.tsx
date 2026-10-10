// ============================================================
// Record Review Dialog
//
// Shown after recording mode is toggled off (when there are
// recorded keyframes). Allows the user to apply simplification
// before committing the keyframes as events.
// ============================================================

import { useState, useMemo } from "react";
import { CircleDot } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { previewSimplification } from "../../utils/keyframeSimplify";
import type { SimplifiableKeyframe } from "../../utils/keyframeSimplify";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";

interface RecordReviewDialogProps {
  open: boolean;
  onClose: () => void;
  // D1: the dialog signals INTENT (raw vs. simplified-at-threshold); the actual
  // multi-channel keyframe→event conversion happens in commitRecordedKeyframes
  // (wired in App's onAccept). Passing the dialog's collapsed SimplifiableKeyframe[]
  // would drop the y/rotation channels. null = raw (no simplification).
  onAccept: (simplifyThreshold: number | null) => void;
}

export function RecordReviewDialog({ open, onClose, onAccept }: RecordReviewDialogProps) {
  const recordedKeyframes = useEditorStore((s) => s.recordedKeyframes);
  const [threshold, setThreshold] = useState(0.5);

  const asSimplifiable: SimplifiableKeyframe[] = useMemo(
    () => recordedKeyframes.map((kf) => ({ beat: kf.beat, value: kf.x ?? kf.y ?? kf.rotation ?? 0 })),
    [recordedKeyframes],
  );

  const simplifiedCount = useMemo(
    () => previewSimplification(asSimplifiable, threshold),
    [asSimplifiable, threshold],
  );

  if (!open || recordedKeyframes.length === 0) return null;

  return (
    <Dialog
      title="Review recorded keyframes"
      icon={CircleDot}
      onClose={onClose}
      width={384}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAccept(null)}>Accept raw</Button>
          <Button variant="primary" onClick={() => onAccept(threshold)}>Accept simplified</Button>
        </>
      }
    >
      <div style={{ fontSize: "var(--fs-body)", color: "var(--text-secondary)", marginBottom: "var(--space-12)" }}>
        Recorded <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{recordedKeyframes.length}</strong> keyframes.
        Adjust simplification to reduce redundant points.
      </div>

      {/* Simplification threshold slider */}
      <label style={{ display: "block", marginBottom: "var(--space-12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Simplification threshold</span>
          <span style={{ fontSize: "var(--fs-control)", fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{threshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0.01}
          max={10}
          step={0.01}
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent-primary)" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "var(--space-2)",
            fontSize: "var(--fs-caption)",
            color: "var(--text-secondary)",
          }}
        >
          <span>Fine (0.01)</span>
          <span>Coarse (10.0)</span>
        </div>
      </label>

      {/* Preview count */}
      <div
        style={{
          padding: "var(--space-8)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-active)",
          fontSize: "var(--fs-body)",
          textAlign: "center",
        }}
      >
        {recordedKeyframes.length} keyframes &rarr; <strong>{simplifiedCount}</strong> after simplification
        <span style={{ marginLeft: "var(--space-8)", color: "var(--text-secondary)" }}>
          ({Math.round((1 - simplifiedCount / recordedKeyframes.length) * 100)}% reduction)
        </span>
      </div>
    </Dialog>
  );
}
