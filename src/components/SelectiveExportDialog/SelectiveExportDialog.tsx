// ============================================================
// Selective Export Dialog
//
// Allows exporting a subset of the chart by:
//   - Selecting a beat range (start, end)
//   - Choosing which lines to include
//   - Picking an export format
// Rendered in the shared Dialog chrome.
// ============================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { FileDown } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { beatToFloat } from "../../types/chart";
import type { PhichainChart, Beat, Note, LineEvent } from "../../types/chart";
import { NumericInput } from "../common/FormFields";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { INPUT_STYLE, SELECT_STYLE } from "../common/UIKit";

interface SelectiveExportDialogProps {
  open: boolean;
  onClose: () => void;
}

function beatInRange(beat: Beat, startBeat: number, endBeat: number): boolean {
  const b = beatToFloat(beat);
  return b >= startBeat && b <= endBeat;
}

function filterNotesInRange(notes: Note[], startBeat: number, endBeat: number): Note[] {
  return notes.filter((n) => beatInRange(n.beat, startBeat, endBeat));
}

function filterEventsInRange(events: LineEvent[], startBeat: number, endBeat: number): LineEvent[] {
  return events.filter((e) => {
    const start = beatToFloat(e.start_beat);
    const end = beatToFloat(e.end_beat);
    // Include events that overlap with the range
    return end >= startBeat && start <= endBeat;
  });
}

export function SelectiveExportDialog({ open, onClose }: SelectiveExportDialogProps) {
  const chart = useChartStore((s) => s.chart);

  const [startBeat, setStartBeat] = useState(0);
  const [endBeat, setEndBeat] = useState(32);
  const [selectedLines, setSelectedLines] = useState<Set<number>>(
    () => new Set(chart.lines.map((_, i) => i)),
  );
  const [format, setFormat] = useState<"phichain" | "json">("phichain");

  // D6: re-seed the line selection from the CURRENT lines on every open. The
  // useState initializer above only runs once at first mount (App.tsx keeps
  // this dialog mounted and gates visibility via `if (!open) return null`), so
  // without this the set goes stale — it would hold indices for lines deleted
  // since first mount and miss lines added since. "All lines" matches the
  // initializer's intent (export defaults to the whole chart). grep
  // showSelectiveExport in App.tsx for the always-mounted call site.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedLines(new Set(chart.lines.map((_, i) => i)));
  }, [open, chart.lines]);

  const toggleLine = useCallback((idx: number) => {
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  const selectAllLines = useCallback(() => {
    setSelectedLines(new Set(chart.lines.map((_, i) => i)));
  }, [chart.lines]);

  const deselectAllLines = useCallback(() => {
    setSelectedLines(new Set());
  }, []);

  const previewStats = useMemo(() => {
    let notes = 0;
    let events = 0;
    for (const idx of selectedLines) {
      const line = chart.lines[idx];
      if (!line) continue;
      notes += filterNotesInRange(line.notes, startBeat, endBeat).length;
      events += filterEventsInRange(line.events, startBeat, endBeat).length;
    }
    return { lines: selectedLines.size, notes, events };
  }, [chart, selectedLines, startBeat, endBeat]);

  const handleExport = useCallback(() => {
    const trimmedChart: PhichainChart = {
      format: chart.format,
      offset: chart.offset,
      bpm_list: chart.bpm_list,
      lines: chart.lines
        .filter((_, idx) => selectedLines.has(idx))
        .map((line) => ({
          ...line,
          notes: filterNotesInRange(line.notes, startBeat, endBeat),
          events: filterEventsInRange(line.events, startBeat, endBeat),
        })),
    };

    const jsonStr = JSON.stringify(trimmedChart, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chart-export-${startBeat}-${endBeat}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  }, [chart, selectedLines, startBeat, endBeat, onClose]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE,
    width: "100%",
    fontFamily: "var(--font-mono)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "var(--space-6)",
    fontSize: "var(--fs-control)",
    color: "var(--text-secondary)",
  };

  return (
    <Dialog
      title="Selective export"
      icon={FileDown}
      onClose={onClose}
      width={400}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleExport} disabled={selectedLines.size === 0}>
            Export
          </Button>
        </>
      }
    >
      {/* Beat range */}
      <div style={{ display: "flex", gap: "var(--space-12)", marginBottom: "var(--space-12)" }}>
        <label style={{ flex: 1 }}>
          <span style={labelStyle}>Start beat</span>
          <NumericInput
            style={inputStyle}
            commitMode="blur"
            min={0}
            step={1}
            fallback={0}
            value={startBeat}
            onChange={setStartBeat}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={labelStyle}>End beat</span>
          <NumericInput
            style={inputStyle}
            commitMode="blur"
            min={0}
            step={1}
            fallback={0}
            value={endBeat}
            onChange={setEndBeat}
          />
        </label>
      </div>

      {/* Line selection */}
      <div style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
          <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Lines</span>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <Button variant="ghost" size="sm" onClick={selectAllLines}>All</Button>
            <Button variant="ghost" size="sm" onClick={deselectAllLines}>None</Button>
          </div>
        </div>
        <div
          style={{
            maxHeight: 128,
            overflowY: "auto",
            padding: "var(--space-4)",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--bg-tertiary)",
            border: "var(--hairline) solid var(--border-color)",
          }}
        >
          {chart.lines.map((line, idx) => (
            <label
              key={idx}
              className="ui-hover"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-8)",
                padding: "var(--space-2) var(--space-6)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-body)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedLines.has(idx)}
                onChange={() => toggleLine(idx)}
              />
              <span style={{ color: selectedLines.has(idx) ? "var(--text-primary)" : "var(--text-secondary)" }}>
                {line.name || `Line ${idx + 1}`}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: "var(--text-secondary)",
                  fontSize: "var(--fs-caption)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {line.notes.length} notes
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Format selector */}
      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
        <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Format</span>
        <select
          style={SELECT_STYLE}
          value={format}
          onChange={(e) => setFormat(e.target.value as "phichain" | "json")}
        >
          <option value="phichain">Phichain JSON</option>
          <option value="json">Raw JSON</option>
        </select>
      </label>

      {/* Preview stats */}
      <div
        style={{
          padding: "var(--space-8) var(--space-12)",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-active)",
          fontSize: "var(--fs-body)",
          color: "var(--text-secondary)",
        }}
      >
        Export: {previewStats.lines} lines, {previewStats.notes} notes, {previewStats.events} events
      </div>
    </Dialog>
  );
}
