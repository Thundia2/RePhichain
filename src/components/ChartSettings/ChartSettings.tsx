import { useChartStore } from "../../stores/chartStore";
import { Card, CardRow, SectionHeader, INPUT_STYLE, SELECT_STYLE } from "../common/UIKit";
import { NumericInput } from "../common/FormFields";

/** Number wells use the mono face. */
const NUM_INPUT_STYLE: React.CSSProperties = { ...INPUT_STYLE, width: 100, fontFamily: "var(--font-mono)" };

export function ChartSettings() {
  const offset = useChartStore((s) => s.chart.offset);
  const meta = useChartStore((s) => s.meta);
  const setOffset = useChartStore((s) => s.setOffset);
  const setMeta = useChartStore((s) => s.setMeta);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "var(--space-12)", fontSize: "var(--fs-body)" }}>
      <SectionHeader>Chart</SectionHeader>

      {/* Offset */}
      <Card>
        <CardRow label="Offset" description="Audio offset in seconds" last>
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            step="0.001"
            value={offset}
            onChange={setOffset}
          />
        </CardRow>
      </Card>

      <SectionHeader>Metadata</SectionHeader>

      {/* Metadata fields */}
      <Card>
        <CardRow label="Name">
          <input
            style={{ ...INPUT_STYLE, flex: 1, width: 140 }}
            type="text"
            value={meta.name}
            onChange={(e) => setMeta({ name: e.target.value })}
          />
        </CardRow>
        <CardRow label="Level">
          <input
            style={{ ...INPUT_STYLE, flex: 1, width: 140 }}
            type="text"
            value={meta.level}
            onChange={(e) => setMeta({ level: e.target.value })}
          />
        </CardRow>
        <CardRow label="Composer">
          <input
            style={{ ...INPUT_STYLE, flex: 1, width: 140 }}
            type="text"
            value={meta.composer}
            onChange={(e) => setMeta({ composer: e.target.value })}
          />
        </CardRow>
        <CardRow label="Charter">
          <input
            style={{ ...INPUT_STYLE, flex: 1, width: 140 }}
            type="text"
            value={meta.charter}
            onChange={(e) => setMeta({ charter: e.target.value })}
          />
        </CardRow>
        <CardRow label="Illustrator" last>
          <input
            style={{ ...INPUT_STYLE, flex: 1, width: 140 }}
            type="text"
            value={meta.illustrator}
            onChange={(e) => setMeta({ illustrator: e.target.value })}
          />
        </CardRow>
      </Card>

      <SectionHeader>Phira / info.yml</SectionHeader>

      {/* Phira Extended Fields */}
      <Card>
        <CardRow label="Preview start">
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            optional
            step="0.1"
            placeholder="0"
            value={meta.preview_start}
            onChange={(v) => setMeta({ preview_start: v })}
            onEmpty={() => setMeta({ preview_start: undefined })}
          />
        </CardRow>
        <CardRow label="Preview end">
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            optional
            step="0.1"
            placeholder="auto (+15s)"
            value={meta.preview_end}
            onChange={(v) => setMeta({ preview_end: v })}
            onEmpty={() => setMeta({ preview_end: undefined })}
          />
        </CardRow>
        <CardRow label="Aspect ratio">
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            optional
            step="0.01"
            placeholder="1.778 (16:9)"
            value={meta.aspect_ratio}
            onChange={(v) => setMeta({ aspect_ratio: v })}
            onEmpty={() => setMeta({ aspect_ratio: undefined })}
          />
        </CardRow>
        <CardRow label="BG dim">
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            optional
            step="0.05"
            min={0}
            max={1}
            placeholder="0.6"
            value={meta.background_dim}
            onChange={(v) => setMeta({ background_dim: v })}
            onEmpty={() => setMeta({ background_dim: undefined })}
          />
        </CardRow>
        <CardRow label="Line length">
          <NumericInput
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            optional
            step="0.5"
            placeholder="6.0"
            value={meta.line_length}
            onChange={(v) => setMeta({ line_length: v })}
            onEmpty={() => setMeta({ line_length: undefined })}
          />
        </CardRow>
        <CardRow label="Tip">
          <input
            style={{ ...INPUT_STYLE, width: 140 }}
            type="text"
            placeholder="Loading screen tip"
            value={meta.tip ?? ""}
            onChange={(e) => setMeta({ tip: e.target.value || undefined })}
          />
        </CardRow>
        <CardRow label="Tags">
          <input
            style={{ ...INPUT_STYLE, width: 140 }}
            type="text"
            placeholder="tag1, tag2, …"
            value={(meta.tags ?? []).join(", ")}
            onChange={(e) => {
              const raw = e.target.value;
              const tags = raw ? raw.split(",").map(t => t.trim()).filter(Boolean) : undefined;
              setMeta({ tags });
            }}
          />
        </CardRow>
        <CardRow label="Intro">
          <input
            style={{ ...INPUT_STYLE, width: 140 }}
            type="text"
            placeholder="Chart introduction"
            value={meta.intro ?? ""}
            onChange={(e) => setMeta({ intro: e.target.value || undefined })}
          />
        </CardRow>
        <CardRow label="Hold cover" last>
          <select
            style={{ ...SELECT_STYLE, width: 120 }}
            value={meta.hold_partial_cover == null ? "" : meta.hold_partial_cover ? "tail" : "head"}
            onChange={(e) => {
              if (e.target.value === "") setMeta({ hold_partial_cover: undefined });
              else setMeta({ hold_partial_cover: e.target.value === "tail" });
            }}
          >
            <option value="">Default (head)</option>
            <option value="head">Head</option>
            <option value="tail">Tail</option>
          </select>
        </CardRow>
      </Card>
    </div>
  );
}
