// ============================================================
// Batch Offset Editor — Leader/follower stagger system
//
// Select a leader line, configure beat offsets for followers,
// then apply staggered copies of the leader's latest event.
// ============================================================

import type React from "react";
import { useState, useMemo, useEffect } from "react";
import { useMultiSelectedLineIndices } from "../../../stores/selection";
import { useChartStore } from "../../../stores/chartStore";
import { createStaggeredEvents, generateEvenOffsets } from "../../../utils/batchEventOffset";
import type { LineEventKind } from "../../../types/chart";
import { NumericInput } from "../../common/FormFields";
import { Button } from "../../common/Button";
import { SegmentedControl } from "../../common/SegmentedControl";
import { EmptyState, INPUT_STYLE, SELECT_STYLE } from "../../common/UIKit";

const CHANNEL_OPTIONS: { kind: LineEventKind; label: string; color: string }[] = [
  { kind: "x", label: "X", color: "var(--event-x)" },
  { kind: "y", label: "Y", color: "var(--event-y)" },
  { kind: "rotation", label: "Rotation", color: "var(--event-rotation)" },
  { kind: "opacity", label: "Opacity", color: "var(--event-opacity)" },
  { kind: "speed", label: "Speed", color: "var(--event-speed)" },
];

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)", padding: "var(--space-4) 0",
};

const OFFSET_INPUT: React.CSSProperties = {
  ...INPUT_STYLE, height: "var(--control-sm)", padding: "0 var(--space-4)",
  fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", textAlign: "center",
};

export function BatchOffsetEditor() {
  const multiSelectedLineIndices = useMultiSelectedLineIndices();
  const chart = useChartStore((s) => s.chart);
  const batchMutate = useChartStore((s) => s.batchMultiLineMutations);

  const [leaderIndex, setLeaderIndex] = useState<number | null>(
    multiSelectedLineIndices.length > 0 ? multiSelectedLineIndices[0] : null,
  );
  const [channel, setChannel] = useState<LineEventKind>("x");
  const [offsets, setOffsets] = useState<Record<number, number>>({});
  const [spacing, setSpacing] = useState(0.5);

  const followers = useMemo(
    () => multiSelectedLineIndices.filter((i) => i !== leaderIndex),
    [multiSelectedLineIndices, leaderIndex],
  );

  // I2: keep the leader derived from the live selection. The useState seed above
  // only runs at first mount, so the leader would pin to the originally-selected
  // line[0] and go stale — once the user re-selects a different line set, the old
  // leader is no longer in multiSelectedLineIndices, making the <select> show an
  // out-of-list value and every selected line fall into `followers`. Reconcile to
  // the primary (first-selected) line whenever the current leader drops out of the
  // selection; a still-selected manual pick is preserved. grep
  // multiSelectedLineIds in editorStore for the ordered selection source.
  useEffect(() => {
    if (leaderIndex !== null && multiSelectedLineIndices.includes(leaderIndex)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeaderIndex(multiSelectedLineIndices.length > 0 ? multiSelectedLineIndices[0] : null);
  }, [multiSelectedLineIndices, leaderIndex]);

  const handleAutoStagger = () => {
    const evenOffsets = generateEvenOffsets(followers.length, spacing);
    const newOffsets: Record<number, number> = {};
    followers.forEach((lineIdx, i) => {
      newOffsets[lineIdx] = evenOffsets[i] ?? 0;
    });
    setOffsets(newOffsets);
  };

  const handleApply = () => {
    if (leaderIndex === null || !chart) return;

    const followerConfigs = followers.map((lineIdx) => ({
      lineIndex: lineIdx,
      beatOffset: offsets[lineIdx] ?? 0,
    }));

    const mutations = createStaggeredEvents(leaderIndex, followerConfigs, channel, chart);
    if (mutations && mutations.length > 0) {
      batchMutate(mutations);
    }
  };

  if (multiSelectedLineIndices.length < 2) {
    return <EmptyState>Select 2 or more lines to use batch offset editing</EmptyState>;
  }

  return (
    <div>
      {/* Leader selector */}
      <div style={{ marginBottom: "var(--space-10)" }}>
        <label htmlFor="batch-offset-leader" style={{ ...SECTION_LABEL, display: "block" }}>
          Leader line
        </label>
        <select
          id="batch-offset-leader"
          value={leaderIndex ?? ""}
          onChange={(e) => setLeaderIndex(Number(e.target.value))}
          style={{ ...SELECT_STYLE, width: "100%" }}
        >
          {multiSelectedLineIndices.map((idx) => (
            <option key={idx} value={idx}>
              Line {idx} — {chart?.lines[idx]?.name || `Line ${idx}`}
            </option>
          ))}
        </select>
      </div>

      {/* Channel selector */}
      <div style={{ marginBottom: "var(--space-10)" }}>
        <div style={SECTION_LABEL}>Event channel</div>
        <SegmentedControl
          label="Event channel"
          size="sm"
          options={CHANNEL_OPTIONS.map((opt) => ({
            value: opt.kind,
            label: (
              <>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
                {opt.label}
              </>
            ),
          }))}
          value={channel}
          onChange={setChannel}
        />
      </div>

      {/* Follower list with offsets */}
      <div style={{ marginBottom: "var(--space-10)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-6)", padding: "var(--space-4) 0" }}>
          <span style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)" }}>
            Followers ({followers.length})
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <NumericInput
              commitMode="blur"
              value={spacing}
              onChange={setSpacing}
              step={0.25}
              min={0.1}
              fallback={0.5}
              title="Stagger spacing (beats)"
              style={{ ...OFFSET_INPUT, width: 48 }}
            />
            <Button size="sm" onClick={handleAutoStagger} title="Evenly space follower offsets by this spacing">
              Auto
            </Button>
          </div>
        </div>

        <div style={{ background: "var(--bg-active)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          {followers.map((lineIdx, i) => (
            <div
              key={lineIdx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-6)",
                padding: "var(--space-4) var(--space-10)",
                borderBottom: i < followers.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                fontSize: "var(--fs-caption)",
              }}
            >
              <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                Line {lineIdx}
              </span>
              <span style={{ flex: 1, minWidth: 0, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {chart?.lines[lineIdx]?.name || ""}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>+</span>
              <NumericInput
                commitMode="blur"
                value={offsets[lineIdx] ?? 0}
                onChange={(v) =>
                  setOffsets((prev) => ({ ...prev, [lineIdx]: v }))
                }
                step={0.25}
                fallback={0}
                title={`Beat offset for line ${lineIdx}`}
                style={{ ...OFFSET_INPUT, width: 52 }}
              />
              <span style={{ color: "var(--text-secondary)" }}>beats</span>
            </div>
          ))}
        </div>
      </div>

      {/* Apply button */}
      <Button
        variant="primary"
        size="lg"
        block
        onClick={handleApply}
        disabled={leaderIndex === null || followers.length === 0}
      >
        Apply stagger
      </Button>
    </div>
  );
}
