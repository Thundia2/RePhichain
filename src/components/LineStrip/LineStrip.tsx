// ============================================================
// Line Strip — Horizontal line selector chip bar
//
// Recent change: Added note-based activity classification and
// inactivity timeout. Lines with notes approaching are now active
// even without opacity. Lines idle for >N seconds (setting) are
// demoted to inactive. Added wheel-scroll support on the chip bar.
//
// 30px tall bar above the canvas with a segmented strip of chips,
// one per line: a 6px dot in the line's category colour, the name,
// and the note count as a mono caption. The selected chip is
// accent-selected. Lines are sorted by activity:
//   - Active (opacity > 0 OR notes approaching): primary text
//   - Coming soon (within 8 beats) / just passed (within 8 beats)
//   - Long ago passed / inactive (no notes for >N seconds): dimmed
// The tier (and "recurring") is spelled out in each chip's tooltip.
// ============================================================

import { useMemo, useRef, useEffect, useCallback } from "react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import {
  useSelectedLineIndex,
  useMultiSelectedLineIndices,
  selectLineByIndex,
  toggleMultiSelectedLineByIndex,
} from "../../stores/selection";
import { useAudioStore } from "../../stores/audioStore";
import { useGroupStore } from "../../stores/groupStore";
import { useTabStore } from "../../stores/tabStore";
import { evaluateLineEventsWithLayers } from "../../canvas/events";
import { BpmList } from "../../utils/bpmList";
import { getPlayheadBeat } from "../../utils/playhead";
import { beatToFloat } from "../../utils/beat";
import type { LineEvent, LineEventValue, EventLayer, Note } from "../../types/chart";
import { useSettingsStore } from "../../stores/settingsStore";
import { LINE_CATEGORY_COLORS, LINE_CATEGORY_LABELS } from "../LineList/lineCategories";
import { autoCategorize } from "../LineList/lineCategories";
import { Plus, Search } from "lucide-react";
import { IconButton } from "../common/IconButton";
import { Tooltip } from "../common/Tooltip";
import { INPUT_STYLE } from "../common/UIKit";

type LineActivity = "active" | "coming-soon" | "just-passed" | "long-passed" | "inactive";

const LOOKAHEAD_BEATS = 8;
const LOOKBEHIND_BEATS = 8;
const LONG_PASSED_BEATS = 32;

// Time window (seconds) before a note's beat during which it's considered "approaching" / visible on screen
const NOTE_APPROACH_WINDOW_SECONDS = 2.5;

/**
 * Binary search: find the index of the first note whose beat >= targetBeat.
 * Notes must be sorted by beatToFloat(note.beat) ascending.
 * Returns notes.length if all notes are before targetBeat.
 */
function lowerBoundNoteBeat(notes: Note[], targetBeat: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (beatToFloat(notes[mid].beat) < targetBeat) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/**
 * Check if any notes are "falling" near the current beat (within the approach window),
 * and find the time until the next note (for inactivity timeout).
 */
function getNoteProximity(
  notes: Note[],
  currentBeat: number,
  bpmList: BpmList,
  approachWindowSeconds: number,
): { hasNotesApproaching: boolean; secondsUntilNextNote: number } {
  if (notes.length === 0) {
    return { hasNotesApproaching: false, secondsUntilNextNote: Infinity };
  }

  const currentTime = bpmList.timeAtFloat(currentBeat);

  // Convert approach window to beat range via BpmList.
  // Check notes within [currentTime - approachWindow, currentTime + 0.1s].
  // The +0.1s grace allows notes that just passed to still count briefly.
  const windowStartBeat = bpmList.beatAtFloat(Math.max(0, currentTime - approachWindowSeconds));
  const windowEndBeat = bpmList.beatAtFloat(currentTime + 0.1);

  const startIdx = lowerBoundNoteBeat(notes, windowStartBeat);
  let hasNotesApproaching = false;

  for (let i = startIdx; i < notes.length; i++) {
    const noteBeat = beatToFloat(notes[i].beat);
    if (noteBeat > windowEndBeat) break;
    hasNotesApproaching = true;
    break;
  }

  // Find seconds until next note (for inactivity timeout).
  // Search for the first note at or after currentBeat.
  const nextIdx = lowerBoundNoteBeat(notes, currentBeat);
  let secondsUntilNextNote = Infinity;

  if (nextIdx < notes.length) {
    const nextNoteBeat = beatToFloat(notes[nextIdx].beat);
    const nextNoteTime = bpmList.timeAtFloat(nextNoteBeat);
    secondsUntilNextNote = nextNoteTime - currentTime;
  }

  return { hasNotesApproaching, secondsUntilNextNote };
}

/** Get all beat ranges where a line has opacity > 0 */
function getOpacityRanges(
  events: { kind: string; start_beat: [number, number, number]; end_beat: [number, number, number]; value: LineEventValue }[],
): { start: number; end: number }[] {
  const opacityEvents = events
    .filter((e) => e.kind === "opacity")
    .sort((a, b) => beatToFloat(a.start_beat) - beatToFloat(b.start_beat));

  if (opacityEvents.length === 0) return [];

  const ranges: { start: number; end: number }[] = [];
  let rangeStart: number | null = null;

  for (const event of opacityEvents) {
    const start = beatToFloat(event.start_beat);
    const end = beatToFloat(event.end_beat);

    let hasOpacity = false;
    if ("constant" in event.value) {
      hasOpacity = event.value.constant > 0;
    } else if ("transition" in event.value) {
      hasOpacity = event.value.transition.start > 0 || event.value.transition.end > 0;
    }

    if (hasOpacity) {
      if (rangeStart === null) rangeStart = start;
      // Extend to end of this event
      if (ranges.length > 0 && ranges[ranges.length - 1].end >= start) {
        ranges[ranges.length - 1].end = Math.max(ranges[ranges.length - 1].end, end);
      } else {
        if (rangeStart !== null && ranges.length > 0) {
          ranges[ranges.length - 1].end = Math.max(ranges[ranges.length - 1].end, start);
        }
        ranges.push({ start, end });
      }
      rangeStart = null;
    } else {
      // Opacity goes to 0 — close current range at start of this event
      if (ranges.length > 0) {
        ranges[ranges.length - 1].end = Math.min(ranges[ranges.length - 1].end, end);
      }
      rangeStart = null;
    }
  }

  return ranges;
}

/** Classify a line's activity status at a given beat, considering both opacity and notes */
function classifyLine(
  events: LineEvent[],
  eventLayers: EventLayer[] | undefined,
  beat: number,
  notes: Note[],
  bpmList: BpmList,
  inactivityTimeoutSeconds: number,
): { activity: LineActivity; isRecurring: boolean; sortKey: number } {
  // Evaluate opacity at current beat
  const state = evaluateLineEventsWithLayers(events, eventLayers, beat);
  const isVisible = state.opacity > 0;

  // Get opacity ranges to check proximity
  const ranges = getOpacityRanges(events);
  const isRecurring = ranges.length > 1;

  // Check note proximity — are notes currently falling on this line?
  const { hasNotesApproaching, secondsUntilNextNote } = getNoteProximity(
    notes, beat, bpmList, NOTE_APPROACH_WINDOW_SECONDS,
  );

  // Priority 1: Opacity-visible lines are always active
  if (isVisible) {
    return { activity: "active", isRecurring, sortKey: 0 };
  }

  // Priority 2: Lines with notes currently approaching are active (slightly lower sort priority)
  if (hasNotesApproaching) {
    return { activity: "active", isRecurring, sortKey: 0.5 };
  }

  // Priority 3: Inactivity timeout — no note coming for a long time, demote to inactive.
  // This overrides coming-soon/just-passed opacity classifications when notes are absent.
  if (inactivityTimeoutSeconds > 0 && secondsUntilNextNote > inactivityTimeoutSeconds) {
    return { activity: "inactive", isRecurring, sortKey: 4 + secondsUntilNextNote / 1000 };
  }

  // Check "coming soon": is there a visible range starting within LOOKAHEAD_BEATS?
  let nearestFuture = Infinity;
  let nearestPast = -Infinity;

  for (const range of ranges) {
    if (range.start > beat && range.start - beat < nearestFuture) {
      nearestFuture = range.start - beat;
    }
    if (range.end <= beat && beat - range.end < Math.abs(nearestPast)) {
      nearestPast = beat - range.end;
    }
  }

  if (nearestFuture <= LOOKAHEAD_BEATS) {
    return { activity: "coming-soon", isRecurring, sortKey: 1 + nearestFuture / LOOKAHEAD_BEATS };
  }

  if (nearestPast >= 0 && nearestPast <= LOOKBEHIND_BEATS) {
    return { activity: "just-passed", isRecurring, sortKey: 2 + nearestPast / LOOKBEHIND_BEATS };
  }

  if (nearestPast >= 0 && nearestPast <= LONG_PASSED_BEATS) {
    return { activity: "long-passed", isRecurring, sortKey: 3 + nearestPast / LONG_PASSED_BEATS };
  }

  // Inactive — sort by how far ahead they appear
  if (nearestFuture < Infinity) {
    return { activity: "inactive", isRecurring, sortKey: 4 + nearestFuture / 1000 };
  }

  return { activity: "inactive", isRecurring, sortKey: 5 };
}

/** Readable name for each activity tier (chip tooltip). */
const ACTIVITY_LABEL: Record<LineActivity, string> = {
  active: "Active",
  "coming-soon": "Coming soon",
  "just-passed": "Just passed",
  "long-passed": "Passed",
  inactive: "Inactive",
};

/**
 * Chip text emphasis per activity tier. Chips are transparent segments;
 * the selected chip is accent-selected. Activity is shown by emphasis
 * (active = primary text, weight 500; long-passed / inactive = dimmed),
 * the sort order, and the tooltip — not by coloured tiles.
 */
function getChipStyle(
  activity: LineActivity,
  isSelected: boolean,
  isMultiSelected: boolean,
): React.CSSProperties {
  if (isSelected) {
    return { background: "var(--accent-selected)", color: "var(--accent-primary)", fontWeight: 500 };
  }
  if (isMultiSelected) {
    return { background: "var(--accent-tint)", color: "var(--accent-primary)" };
  }
  switch (activity) {
    case "active":
      return { color: "var(--text-primary)", fontWeight: 500 };
    case "coming-soon":
    case "just-passed":
      return {};
    default:
      return { opacity: 0.6 };
  }
}

export function LineStrip() {
  const lines = useChartStore((s) => s.chart.lines);
  const bpmPoints = useChartStore((s) => s.chart.bpm_list);
  const offset = useChartStore((s) => s.chart.offset);
  const selectedLineIndex = useSelectedLineIndex();
  const multiSelectedLineIndices = useMultiSelectedLineIndices();
  const addLine = useChartStore((s) => s.addLine);
  const groups = useGroupStore((s) => s.groups);
  const openUnrolledLineEditor = useTabStore((s) => s.openUnrolledLineEditor);
  const currentTime = useAudioStore((s) => s.currentTime);
  const inactivityTimeoutSeconds = useSettingsStore((s) => s.lineInactivityTimeoutSeconds);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // LineStrip filter state
  const searchOpen = useEditorStore((s) => s.lineStripSearchOpen);
  const searchQuery = useEditorStore((s) => s.lineStripSearchQuery);
  const categoryFilter = useEditorStore((s) => s.lineStripCategoryFilter);
  const setLineStripSearch = useEditorStore((s) => s.setLineStripSearch);
  const toggleLineStripSearch = useEditorStore((s) => s.toggleLineStripSearch);
  const toggleLineStripCategory = useEditorStore((s) => s.toggleLineStripCategory);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // BpmList for time-to-beat conversion
  const bpmList = useMemo(() => new BpmList(bpmPoints), [bpmPoints]);
  const currentBeat = useMemo(() => bpmList.beatAtFloat(currentTime - offset), [bpmList, currentTime, offset]);
  // Z3: quantize to half-beats for classification. The activity tiers only change at beat
  // granularity (coming-soon within 8 beats, etc.), so classifyBeat stays a stable number
  // for ~half a beat — that drops lineData's classifyLine sweep (opacity-range scans +
  // note binary-searches, for every line) from 60Hz during playback to ~2-4Hz.
  const classifyBeat = Math.floor(currentBeat * 2) / 2;

  // Classify all lines and compute sort order (considers both opacity and note proximity)
  const lineData = useMemo(() => {
    return lines.map((line, i) => {
      const classification = classifyLine(
        line.events, line.event_layers, classifyBeat,
        line.notes, bpmList, inactivityTimeoutSeconds,
      );
      const category = line._category ?? autoCategorize(line);
      return { index: i, line, category, ...classification };
    });
  }, [lines, classifyBeat, bpmList, inactivityTimeoutSeconds]);

  // Sort: active first, then coming-soon, just-passed, long-passed, inactive
  const sortedLines = useMemo(() => {
    return [...lineData].sort((a, b) => a.sortKey - b.sortKey);
  }, [lineData]);

  // Apply search and category filters
  const filteredLines = useMemo(() => {
    let result = sortedLines;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(({ line, index }) =>
        (line.name || `Line ${index}`).toLowerCase().includes(q),
      );
    }
    if (categoryFilter) {
      result = result.filter(({ category }) => category && categoryFilter.includes(category));
    }
    return result;
  }, [sortedLines, searchQuery, categoryFilter]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      toggleLineStripSearch();
    }
  }, [toggleLineStripSearch]);

  // W8: attach the horizontal-scroll wheel handler NATIVELY with { passive: false }.
  // React's onWheel is registered passively, so e.preventDefault() there is a no-op (and
  // logs an "Unable to preventDefault inside passive event listener" warning) — the chip
  // bar couldn't swallow the canvas's vertical-scroll seek. deltaY drives the horizontal
  // scroll (deltaX fallback for trackpads); stopPropagation keeps it off the canvas.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Auto-scroll selected line into view
  useEffect(() => {
    if (selectedLineIndex === null || !scrollRef.current) return;
    const chip = scrollRef.current.querySelector(`[data-line-index="${selectedLineIndex}"]`);
    if (chip) {
      chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [selectedLineIndex]);

  return (
    <div
      ref={scrollRef}
      style={{
        height: 30,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "0 var(--space-8)",
        background: "var(--bg-tertiary)",
        borderBottom: "var(--rule) solid var(--border-color)",
        overflowX: "auto",
        overflowY: "hidden",
        flexShrink: 0,
        flexWrap: "nowrap",
        scrollbarWidth: "none",
      }}
      className="linestrip-scroll"
    >
      {/* Search toggle button */}
      <IconButton
        icon={Search}
        label="Search lines"
        shortcut="Ctrl+L"
        size="md"
        active={searchOpen}
        onClick={toggleLineStripSearch}
        tooltipPosition="bottom"
      />

      {/* Search input (visible when open) */}
      {searchOpen && (
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setLineStripSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search lines…"
          aria-label="Search lines"
          style={{
            ...INPUT_STYLE,
            width: 120,
            flexShrink: 0,
          }}
        />
      )}

      {/* Category filter dots (category colours are line data colours) */}
      {(["gameplay", "visual", "text", "helper"] as const).map((cat) => (
        <IconButton
          key={cat}
          label={`Filter: ${LINE_CATEGORY_LABELS[cat] ?? cat}`}
          size="sm"
          active={categoryFilter?.includes(cat) ?? false}
          onClick={() => toggleLineStripCategory(cat)}
          tooltipPosition="bottom"
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: "var(--radius-full)",
              background: LINE_CATEGORY_COLORS[cat],
              opacity: !categoryFilter || categoryFilter.includes(cat) ? 1 : 0.25,
            }}
          />
        </IconButton>
      ))}

      {/* Separator */}
      <div style={{ width: "var(--rule)", height: 16, margin: "0 var(--space-4)", background: "var(--border-color)", flexShrink: 0 }} />

      {filteredLines.map(({ index, line, activity, isRecurring, category }) => {
        const isSelected = selectedLineIndex === index;
        const isMultiSelected = multiSelectedLineIndices.includes(index);
        const chipStyle = getChipStyle(activity, isSelected, isMultiSelected);
        const lineGroups = groups.filter((g) => g.type === "line" && g.lines.some((l: { lineIndex: number }) => l.lineIndex === index));

        return (
          <Tooltip key={index} position="bottom" content={`${line.name || `Line ${index}`} — ${ACTIVITY_LABEL[activity]}${isRecurring ? " (recurring)" : ""}${isMultiSelected ? ", multi-selected" : ""}${lineGroups.length > 0 ? ` [${lineGroups.map((g) => g.name).join(", ")}]` : ""}`}>
            <button
              type="button"
              className="ui-segmented__opt"
              data-line-index={index}
              aria-pressed={isSelected}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleMultiSelectedLineByIndex(index);
                } else {
                  selectLineByIndex(isSelected ? null : index);
                }
              }}
              onDoubleClick={() => {
                selectLineByIndex(index);
                // Imperative read in a click handler → raw playhead beat (clamped to ≥0).
                const currentBeat = getPlayheadBeat({ clampNonNegative: true });
                openUnrolledLineEditor(index, line.name || `Line ${index + 1}`, currentBeat);
              }}
              style={{
                height: "var(--control-md)",
                minHeight: "var(--control-md)",
                padding: "0 var(--space-8)",
                borderRadius: "var(--radius-md)",
                gap: "var(--space-4)",
                flexShrink: 0,
                overflow: "visible",
                ...chipStyle,
              }}
            >
              {category && LINE_CATEGORY_COLORS[category] && (
                <span style={{
                  width: 6, height: 6, borderRadius: "var(--radius-full)",
                  background: LINE_CATEGORY_COLORS[category], flexShrink: 0,
                }} />
              )}
              {lineGroups.map((g) => (
                <span
                  key={g.id}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "var(--radius-full)",
                    background: g.color,
                    flexShrink: 0,
                  }}
                />
              ))}
              {line.name || `Untitled`}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-caption)",
                  fontWeight: 400,
                  color: isSelected || isMultiSelected ? "inherit" : "var(--text-secondary)",
                  opacity: isSelected || isMultiSelected ? 0.75 : 1,
                }}
              >
                {line.notes.length}
              </span>
            </button>
          </Tooltip>
        );
      })}
      <IconButton
        icon={Plus}
        label="Add new line"
        size="md"
        onClick={() => addLine()}
        tooltipPosition="bottom"
      />
      <style>{`.linestrip-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
