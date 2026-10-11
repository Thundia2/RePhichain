// ============================================================
// Line List — Scrollable list of chart judgment lines
//
// Displays all lines in the chart with sorting (index, name,
// note count, first appearance), filtering by category, and
// group color indicators. Supports multi-select, drag
// reordering, and inline actions (add, duplicate, delete).
// Rows hover via ui-hover; the selected row is accent-selected.
// ============================================================

import { useState, useMemo, useRef, useEffect } from "react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useSelectedLineIndex, selectLineByIndex } from "../../stores/selection";
import { useAudioStore } from "../../stores/audioStore";
import { useTabStore } from "../../stores/tabStore";
import { useGroupStore } from "../../stores/groupStore";
import { evaluateLineEventsWithLayers, getFirstAppearanceBeat } from "../../canvas/events";
import { getPlayheadBeat } from "../../utils/playhead";
import type { LineSortMode } from "../../types/editor";
import { Plus, Trash2, ArrowUp, ArrowDown, WandSparkles, ImageIcon, SquarePen } from "lucide-react";
import { SELECT_STYLE } from "../common/UIKit";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { Icon } from "../common/Icon";
import { Tooltip } from "../common/Tooltip";
import { LINE_CATEGORY_COLORS, LINE_CATEGORY_LABELS, autoCategorize } from "./lineCategories";
import { LineContextMenu } from "./LineContextMenu";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const countLabel = (notes: number, events: number) => `${plural(notes, "note")} · ${plural(events, "event")}`;

/**
 * Subscribe to the current beat, throttled to 100ms to avoid
 * re-rendering the line list at 60fps from audio time updates.
 */
function useThrottledBeat(): number {
  const [beat, setBeat] = useState(0);
  const lastUpdate = useRef(0);

  const bpmPoints = useChartStore((s) => s.chart.bpm_list);
  const offset = useChartStore((s) => s.chart.offset);

  useEffect(() => {
    const unsub = useAudioStore.subscribe((state) => {
      const now = performance.now();
      if (now - lastUpdate.current < 100) return;
      lastUpdate.current = now;

      // Pass the subscription's state.currentTime so the throttled beat tracks the
      // live clock; raw playhead (clamped ≥0). bpmPoints/offset stay as effect deps
      // to re-subscribe if the chart's tempo map changes.
      const currentBeat = getPlayheadBeat({ time: state.currentTime, clampNonNegative: true });
      setBeat(currentBeat);
    });

    return unsub;
  }, [bpmPoints, offset]);

  return beat;
}

export function LineList() {
  const lines = useChartStore((s) => s.chart.lines);
  const addLine = useChartStore((s) => s.addLine);
  const removeLine = useChartStore((s) => s.removeLine);
  const reorderLines = useChartStore((s) => s.reorderLines);
  const selectedLineIndex = useSelectedLineIndex();
  const lineSortMode = useEditorStore((s) => s.lineSortMode);
  const setLineSortMode = useEditorStore((s) => s.setLineSortMode);
  const openLineEventEditor = useTabStore((s) => s.openLineEventEditor);
  const groups = useGroupStore((s) => s.groups);
  const editLine = useChartStore((s) => s.editLine);
  const currentBeat = useThrottledBeat();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lineIndex: number;
  } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Category counts for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { gameplay: 0, visual: 0, text: 0, helper: 0, none: 0 };
    for (const line of lines) {
      const cat = line._category;
      if (cat && counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.none++;
      }
    }
    return counts;
  }, [lines]);

  // Pre-compute line states for active_first mode (avoid double evaluation)
  const sortedData = useMemo(() => {
    const indices = lines.map((_: unknown, i: number) => i);

    // Only evaluate line states when needed
    const lineStates = lineSortMode === "active_first"
      ? lines.map((line) => evaluateLineEventsWithLayers(line.events, line.event_layers, currentBeat))
      : null;

    if (lineSortMode === "first_appearance") {
      indices.sort((a: number, b: number) => {
        const beatA = getFirstAppearanceBeat(lines[a].events);
        const beatB = getFirstAppearanceBeat(lines[b].events);
        if (beatA !== beatB) return beatA - beatB;
        return a - b; // stable: preserve chart order for ties
      });
    } else if (lineSortMode === "active_first" && lineStates) {
      indices.sort((a: number, b: number) => {
        const visA = lineStates[a].opacity > 0 ? 1 : 0;
        const visB = lineStates[b].opacity > 0 ? 1 : 0;
        if (visA !== visB) return visB - visA; // visible lines first
        return a - b; // stable: preserve chart order within groups
      });
    }

    return { indices, lineStates };
  }, [lines, lineSortMode, currentBeat]);

  const isChartOrder = lineSortMode === "chart_order";

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Action buttons */}
      <div
        className="flex items-center gap-1 p-1 border-b flex-wrap"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => addLine({ name: `Line ${lines.length + 1}` })}
          title="Add line"
        >
          Add
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={() => {
            if (selectedLineIndex !== null) {
              removeLine(selectedLineIndex);
              selectLineByIndex(null);
            }
          }}
          disabled={selectedLineIndex === null}
          title="Remove selected line"
        >
          Remove
        </Button>
        {isChartOrder && selectedLineIndex !== null && selectedLineIndex > 0 && (
          <IconButton
            icon={ArrowUp}
            label="Move line up"
            size="md"
            onClick={() => {
              reorderLines(selectedLineIndex, selectedLineIndex - 1);
              selectLineByIndex(selectedLineIndex - 1);
            }}
          />
        )}
        {isChartOrder && selectedLineIndex !== null && selectedLineIndex < lines.length - 1 && (
          <IconButton
            icon={ArrowDown}
            label="Move line down"
            size="md"
            onClick={() => {
              reorderLines(selectedLineIndex, selectedLineIndex + 1);
              selectLineByIndex(selectedLineIndex + 1);
            }}
          />
        )}
        {/* Sort mode selector */}
        <select
          className="ml-auto"
          style={{
            ...SELECT_STYLE,
            fontSize: "var(--fs-caption)",
          }}
          value={lineSortMode}
          onChange={(e) => setLineSortMode(e.target.value as LineSortMode)}
          aria-label="Sort lines"
        >
          <option value="chart_order">Chart order</option>
          <option value="first_appearance">First appearance</option>
          <option value="active_first">Active first</option>
        </select>
      </div>

      {/* Category filter bar */}
      <div
        className="flex items-center gap-1 px-1 py-0.5 border-b flex-wrap"
        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
      >
        <Tooltip content="Show all lines">
          <button
            type="button"
            className="ui-hover px-1.5 py-0 rounded text-xs"
            aria-pressed={categoryFilter === null}
            style={{
              backgroundColor: categoryFilter === null ? "var(--bg-active)" : undefined,
              color: categoryFilter === null ? "var(--text-primary)" : undefined,
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
            onClick={() => setCategoryFilter(null)}
          >
            All
          </button>
        </Tooltip>
        {(["gameplay", "visual", "text", "helper"] as const).map((cat) => (
          <Tooltip key={cat} content={LINE_CATEGORY_LABELS[cat]}>
            <button
              type="button"
              className="ui-hover flex items-center gap-1 px-1 py-0 rounded text-xs"
              aria-pressed={categoryFilter === cat}
              aria-label={`${LINE_CATEGORY_LABELS[cat]}: ${categoryCounts[cat]} lines`}
              style={{
                backgroundColor: categoryFilter === cat
                  ? `color-mix(in srgb, ${LINE_CATEGORY_COLORS[cat]} 15%, transparent)`
                  : undefined,
                color: categoryFilter === cat ? LINE_CATEGORY_COLORS[cat] : undefined,
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: LINE_CATEGORY_COLORS[cat],
                  flexShrink: 0,
                }}
              />
              {categoryCounts[cat]}
            </button>
          </Tooltip>
        ))}
        <Tooltip content="Auto-categorize lines without a category">
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm ml-auto"
            onClick={() => {
              for (let i = 0; i < lines.length; i++) {
                if (!lines[i]._category) {
                  const cat = autoCategorize(lines[i]);
                  if (cat) editLine(i, { _category: cat });
                }
              }
            }}
          >
            <Icon icon={WandSparkles} size={12} />
            Auto
          </button>
        </Tooltip>
      </div>

      {/* Line list */}
      <div className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="p-2 text-center" style={{ color: "var(--text-secondary)" }}>
            No lines yet
          </div>
        ) : (
          sortedData.indices
            .filter((idx: number) => {
              if (categoryFilter === null) return true;
              return lines[idx]._category === categoryFilter;
            })
            .map((idx: number) => {
            const line = lines[idx];
            const isSelected = selectedLineIndex === idx;
            const isVisible = sortedData.lineStates
              ? sortedData.lineStates[idx].opacity > 0
              : null;

            return (
              <div
                key={idx}
                style={{
                  borderBottom: "var(--rule) solid var(--separator)",
                }}
              >
                <button
                  type="button"
                  className="ui-hover flex items-center gap-2 w-full px-2 py-1.5 text-left"
                  aria-current={isSelected ? "true" : undefined}
                  style={{
                    backgroundColor: isSelected ? "var(--accent-selected)" : undefined,
                    color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
                  }}
                  onClick={() => selectLineByIndex(idx)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, lineIndex: idx });
                  }}
                >
                  {/* Category dot */}
                  <Tooltip content={line._category ? LINE_CATEGORY_LABELS[line._category] : "No category"}>
                    <span
                      role="img"
                      aria-label={line._category ? LINE_CATEGORY_LABELS[line._category] : "No category"}
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "var(--radius-full)",
                        backgroundColor: line._category
                          ? LINE_CATEGORY_COLORS[line._category]
                          : "transparent",
                        border: line._category
                          ? "none"
                          : "var(--rule) solid var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                  </Tooltip>
                  {/* Visibility indicator (active_first mode) */}
                  {lineSortMode === "active_first" && isVisible !== null && (
                    <Tooltip content={isVisible ? "Visible" : "Hidden"}>
                      <span
                        role="img"
                        aria-label={isVisible ? "Visible" : "Hidden"}
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: isVisible ? "var(--success)" : "var(--text-muted)",
                        }}
                      />
                    </Tooltip>
                  )}
                  <span className="flex-1 truncate" style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", minWidth: 0 }}>
                    {groups.filter((g) => g.type === "line" && g.lines.some((l: { lineIndex: number }) => l.lineIndex === idx)).map((g) => (
                      <Tooltip key={g.id} content={`Group: ${g.name}`}>
                        <span
                          role="img"
                          aria-label={`Group: ${g.name}`}
                          style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", background: g.color, flexShrink: 0 }}
                        />
                      </Tooltip>
                    ))}
                    {line.texture && (
                      <Tooltip content="Has texture">
                        <span role="img" aria-label="Has texture" style={{ display: "inline-flex", color: isSelected ? undefined : "var(--text-secondary)" }}>
                          <Icon icon={ImageIcon} size={12} />
                        </span>
                      </Tooltip>
                    )}
                    <span className="truncate">{line.name || `Line ${idx + 1}`}</span>
                  </span>
                  <Tooltip content={countLabel(line.notes.length, line.events.length)} position="right">
                    <span
                      aria-label={countLabel(line.notes.length, line.events.length)}
                      style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", flexShrink: 0 }}
                    >
                      {line.notes.length} · {line.events.length}
                    </span>
                  </Tooltip>
                </button>
                {isSelected && (
                  <div className="pl-6 pr-2 pb-1">
                    <Button
                      variant="primary"
                      size="sm"
                      block
                      icon={SquarePen}
                      onClick={(e) => {
                        e.stopPropagation();
                        openLineEventEditor(idx, line.name || `Line ${idx + 1}`);
                      }}
                      title="Open event editor for this line"
                    >
                      Adjust events
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <LineContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          lineIndex={contextMenu.lineIndex}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
