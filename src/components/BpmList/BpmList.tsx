import { useChartStore } from "../../stores/chartStore";
import type { Beat, BpmPoint } from "../../types/chart";
import { beatToFloat } from "../../types/chart";
import { Plus, Trash2 } from "lucide-react";
import { Card, INPUT_STYLE } from "../common/UIKit";
import { NumericInput } from "../common/FormFields";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";

/** Number wells use the mono face. */
const NUM_INPUT_STYLE: React.CSSProperties = { ...INPUT_STYLE, fontFamily: "var(--font-mono)" };

export function BpmListPanel() {
  const bpmList = useChartStore((s) => s.chart.bpm_list);
  const setBpmList = useChartStore((s) => s.setBpmList);

  const addBpm = () => {
    const lastBpm = bpmList[bpmList.length - 1];
    const wholeBeat = lastBpm
      ? Math.floor(beatToFloat(lastBpm.beat)) + 4
      : 0;
    const newEntry: BpmPoint = {
      beat: [wholeBeat, 0, 1],
      bpm: lastBpm?.bpm ?? 120,
    };
    setBpmList([...bpmList, newEntry]);
  };

  const removeBpm = (index: number) => {
    if (bpmList.length <= 1) return; // Must keep at least one
    setBpmList(bpmList.filter((_, i) => i !== index));
  };

  const editBpm = (index: number, changes: Partial<BpmPoint>) => {
    const newList = bpmList.map((entry, i) =>
      i === index ? { ...entry, ...changes } : entry
    );
    setBpmList(newList);
  };

  const editBeat = (index: number, beat: Beat) => {
    editBpm(index, { beat });
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          padding: "var(--space-8) var(--space-12)",
          borderBottom: "var(--rule) solid var(--separator)",
        }}
      >
        <Button variant="primary" icon={Plus} onClick={addBpm}>
          Add BPM point
        </Button>
        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginLeft: "auto" }}>
          {bpmList.length} point{bpmList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* BPM entries */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-8) var(--space-12)" }}>
        <Card>
          {bpmList.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                padding: "var(--space-8) var(--space-10)",
                borderBottom:
                  idx < bpmList.length - 1
                    ? "var(--rule) solid var(--separator)"
                    : "none",
              }}
            >
              <span
                style={{
                  width: 16,
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: "var(--fs-caption)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {idx}
              </span>

              {/* Beat inputs — commit-on-blur, integer-normalised (L8) */}
              <NumericInput
                style={{ ...NUM_INPUT_STYLE, width: 36, textAlign: "center" }}
                commitMode="blur"
                integer
                value={entry.beat[0]}
                onChange={(v) => editBeat(idx, [v, entry.beat[1], entry.beat[2]])}
                title="Whole beats"
              />
              <NumericInput
                style={{ ...NUM_INPUT_STYLE, width: 28, textAlign: "center" }}
                commitMode="blur"
                integer
                min={0}
                value={entry.beat[1]}
                onChange={(v) => editBeat(idx, [entry.beat[0], v, entry.beat[2]])}
                title="Numerator"
              />
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>/</span>
              <NumericInput
                style={{ ...NUM_INPUT_STYLE, width: 28, textAlign: "center" }}
                commitMode="blur"
                integer
                min={1}
                value={entry.beat[2]}
                onChange={(v) => editBeat(idx, [entry.beat[0], entry.beat[1], v])}
                title="Denominator"
              />

              <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>@</span>

              {/* BPM input — min 1 clamp is the non-positive guard (L8) */}
              <NumericInput
                style={{ ...NUM_INPUT_STYLE, width: 60 }}
                commitMode="blur"
                step="0.1"
                min={1}
                value={entry.bpm}
                onChange={(v) => editBpm(idx, { bpm: v })}
                title="BPM"
              />

              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>BPM</span>

              {/* Remove button */}
              <IconButton
                icon={Trash2}
                label="Remove BPM point"
                size="md"
                danger
                style={{ marginLeft: "auto" }}
                onClick={() => removeBpm(idx)}
                disabled={bpmList.length <= 1}
              />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
