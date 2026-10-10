// ============================================================
// Batch Line Dialog — Create N lines with shared properties.
// Rendered in the shared Dialog chrome.
// ============================================================

import { useState } from "react";
import { useChartStore } from "../../stores/chartStore";
import type { Line } from "../../types/chart";
import { ListPlus } from "lucide-react";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Field, SelectField } from "../common/FormFields";
import { LINE_CATEGORY_LABELS } from "../LineList/lineCategories";

interface BatchLineDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BatchLineDialog({ open, onClose }: BatchLineDialogProps) {
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState("Line");
  const [category, setCategory] = useState<Line["_category"]>("visual");
  const [opacity, setOpacity] = useState(0);
  const [copyFromLine, setCopyFromLine] = useState<number | null>(null);
  const lines = useChartStore((s) => s.chart.lines);

  if (!open) return null;

  const handleCreate = () => {
    for (let i = 0; i < count; i++) {
      const lineOverride: Partial<Line> = {
        name: `${prefix} ${i + 1}`,
        _category: category,
      };

      useChartStore.getState().addLine(lineOverride);

      const freshState = useChartStore.getState();
      const newIdx = freshState.chart.lines.length - 1;
      const newLine = freshState.chart.lines[newIdx];

      if (opacity !== 255 && newLine) {
        const opacityIdx = newLine.events.findIndex((e) => e.kind === "opacity");
        if (opacityIdx >= 0) {
          useChartStore.getState().editEvent(newIdx, opacityIdx, {
            value: { constant: opacity },
          });
        }
      }

      if (copyFromLine !== null) {
        const currentState = useChartStore.getState();
        const sourceLine = currentState.chart.lines[copyFromLine];
        if (sourceLine) {
          for (const event of sourceLine.events) {
            useChartStore.getState().addEvent(newIdx, structuredClone(event));
          }
        }
      }
    }

    onClose();
  };

  const categoryOptions = [
    { value: "", label: "None" },
    ...Object.entries(LINE_CATEGORY_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  const lineOptions = [
    { value: "-1", label: "None" },
    ...lines.map((line, i) => ({
      value: String(i),
      label: `${i}: ${line.name}`,
    })),
  ];

  return (
    <Dialog
      title="Batch create lines"
      icon={ListPlus}
      onClose={onClose}
      width={340}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate}>
            Create {count} lines
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <Field
          label="Count"
          value={count}
          onChange={(v) => setCount(Math.max(1, parseInt(v) || 1))}
          step="1"
          min="1"
          max="50"
        />
        <Field
          label="Prefix"
          value={prefix}
          onChange={(v) => setPrefix(v)}
          type="text"
        />
        <SelectField
          label="Category"
          value={category ?? ""}
          options={categoryOptions}
          onChange={(v) =>
            setCategory((v as Line["_category"]) || undefined)
          }
        />
        <Field
          label="Opacity"
          value={opacity}
          onChange={(v) =>
            setOpacity(Math.max(0, Math.min(255, parseInt(v) || 0)))
          }
          step="1"
          min="0"
          max="255"
        />
        <SelectField
          label="Copy from"
          value={String(copyFromLine ?? -1)}
          options={lineOptions}
          onChange={(v) =>
            setCopyFromLine(parseInt(v) === -1 ? null : parseInt(v))
          }
        />
      </div>
    </Dialog>
  );
}
