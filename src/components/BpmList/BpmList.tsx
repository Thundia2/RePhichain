import { useChartStore } from "../../stores/chartStore";
import type { Beat, BpmPoint } from "../../types/chart";
import { beatToFloat } from "../../types/chart";
import { Card, ActionButton, INPUT_STYLE } from "../common/UIKit";
import { NumericInput } from "../common/FormFields";

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
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid rgba(42, 42, 53, 0.55)",
        }}
      >
        <ActionButton variant="primary" onClick={addBpm} title="Add BPM point">
          + Add BPM Point
        </ActionButton>
        <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
          {bpmList.length} point{bpmList.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* BPM entries */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 12px" }}>
        <Card>
          {bpmList.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "8px 10px",
                borderBottom:
                  idx < bpmList.length - 1
                    ? "1px solid rgba(42, 42, 53, 0.55)"
                    : "none",
              }}
            >
              <span
                style={{
                  width: 16,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 10,
                }}
              >
                {idx}
              </span>

              {/* Beat inputs — commit-on-blur, integer-normalised (L8) */}
              <NumericInput
                style={{ ...INPUT_STYLE, width: 36, textAlign: "center" }}
                commitMode="blur"
                integer
                value={entry.beat[0]}
                onChange={(v) => editBeat(idx, [v, entry.beat[1], entry.beat[2]])}
                title="Whole beats"
              />
              <NumericInput
                style={{ ...INPUT_STYLE, width: 28, textAlign: "center" }}
                commitMode="blur"
                integer
                min={0}
                value={entry.beat[1]}
                onChange={(v) => editBeat(idx, [entry.beat[0], v, entry.beat[2]])}
                title="Numerator"
              />
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>/</span>
              <NumericInput
                style={{ ...INPUT_STYLE, width: 28, textAlign: "center" }}
                commitMode="blur"
                integer
                min={1}
                value={entry.beat[2]}
                onChange={(v) => editBeat(idx, [entry.beat[0], entry.beat[1], v])}
                title="Denominator"
              />

              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>@</span>

              {/* BPM input — min 1 clamp is the non-positive guard (L8) */}
              <NumericInput
                style={{ ...INPUT_STYLE, width: 60 }}
                commitMode="blur"
                step="0.1"
                min={1}
                value={entry.bpm}
                onChange={(v) => editBpm(idx, { bpm: v })}
                title="BPM"
              />

              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>bpm</span>

              {/* Remove button */}
              <button
                style={{
                  marginLeft: "auto",
                  padding: "2px 6px",
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  color: bpmList.length <= 1 ? "var(--text-muted)" : "var(--error)",
                  cursor: bpmList.length <= 1 ? "default" : "pointer",
                  fontSize: 11,
                  opacity: bpmList.length <= 1 ? 0.4 : 1,
                  fontFamily: "inherit",
                }}
                onClick={() => removeBpm(idx)}
                disabled={bpmList.length <= 1}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
