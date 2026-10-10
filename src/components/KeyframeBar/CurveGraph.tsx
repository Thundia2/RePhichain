// ============================================================
// Curve Graph — Visual easing curve editor canvas
//
// Renders easing curves, keyframe diamonds, grid, and playhead.
// Supports: click to select, drag to move keyframes, zoom/pan,
// double-click to create events.
//
// Recent change: Added multi-line overlay support. When timeline
// overlay is enabled, ghost curves from overlayLines are drawn
// behind the main line's curves for cross-line comparison.
// ============================================================

import { useRef, useEffect, useCallback } from "react";
import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { useAudioStore } from "../../stores/audioStore";
import {
  getSelectedLineIndex,
  getSelectedEventIndices,
  useSelectedEventIndices,
  setEventSelectionByIndex,
} from "../../stores/selection";
import { getPlayheadBeat } from "../../utils/playhead";
import { beatToFloat, floatToBeat } from "../../types/chart";
import { renderCurveGraph, type OverlayLine } from "./CurveGraphRenderer";
import { seriesColor } from "../../canvas/chromeTheme";
import {
  type CurveViewport,
  computeAutoRange,
  hitTestKeyframeDiamond,
  xToBeat,
  yToValue,
} from "./curveEditorUtils";

interface CurveGraphProps {
  isPopout?: boolean;
}

export function CurveGraph({ isPopout }: CurveGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const viewportRef = useRef<CurveViewport>({
    beatStart: 0,
    beatEnd: 32,
    valueMin: -100,
    valueMax: 100,
  });
  // K7: the beat (X) window is PERSISTENT — only seeded once, then mutated by the
  // wheel handler (manual zoom) or playback auto-follow. Without this latch the
  // frame loop recomputed beatStart/beatEnd from the playhead every tick, so a
  // paused user could never hold a manual view. Per-instance ref → inline and
  // popout graphs keep independent windows.
  const viewportSeededRef = useRef(false);

  const height = useEditorStore((s) => isPopout ? 400 : s.curveEditorHeight);
  // Subscribe to trigger re-renders when these values change (used in render loop via getState)
  useEditorStore((s) => s.curveEditorVisibleLanes);
  useEditorStore((s) => s.curveEditorNormalized);
  const hoveredKeyframe = useEditorStore((s) => s.curveEditorHoveredKeyframe);
  useSelectedEventIndices(); // subscribe so a selection change re-renders; value read via getState in the loop

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function frame() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const w = rect.width;
      const h = isPopout ? rect.height : useEditorStore.getState().curveEditorHeight;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Get data
      const cs = useChartStore.getState();
      const es = useEditorStore.getState();
      // rAF render loop reads the live clock imperatively → raw playhead beat (clamped ≥0).
      const currentBeat = getPlayheadBeat({ clampNonNegative: true });

      const lineIndex = getSelectedLineIndex();
      const line = lineIndex !== null ? cs.chart.lines[lineIndex] : null;
      const events = line ? line.events : [];

      // Auto-range
      const autoRange = computeAutoRange(events, es.curveEditorVisibleLanes);
      const vr = es.curveEditorValueRange ?? autoRange;

      // Furthest beat of interest — used to seed the default window and to clamp
      // the right edge so the view can't scroll past the chart's content.
      let maxBeat = 32;
      for (const e of events) {
        maxBeat = Math.max(maxBeat, beatToFloat(e.end_beat) + 4);
      }

      // K7: mutate the PERSISTENT viewport in place — never reassign it from the
      // playhead each frame (that was the bug: a paused view kept snapping back).
      const vp = viewportRef.current;

      // Value (Y) axis tracks the stored range (wheel Y-zoom persists it) or auto.
      vp.valueMin = vr.min;
      vp.valueMax = vr.max;

      // Seed the beat (X) window ONCE, centered on the playhead. After this the
      // window is owned by the user (wheel zoom) and the playback follower below.
      if (!viewportSeededRef.current) {
        const initWindow = Math.min(maxBeat, 32);
        vp.beatStart = Math.max(0, currentBeat - initWindow * 0.1);
        vp.beatEnd = vp.beatStart + initWindow;
        viewportSeededRef.current = true;
      }

      // Auto-follow the playhead ONLY while audio is playing — so a paused user can
      // hold a manual pan/zoom. When playing and the head leaves the window, scroll
      // the window (keeping its width) to bring it back into view.
      const isPlaying = useAudioStore.getState().isPlaying;
      const beatWindow = vp.beatEnd - vp.beatStart;
      if (isPlaying && (currentBeat < vp.beatStart || currentBeat > vp.beatEnd)) {
        vp.beatStart = currentBeat - beatWindow * 0.2;
        vp.beatEnd = vp.beatStart + beatWindow;
      }

      // Clamp to the valid range, preserving window width: never start below 0, and
      // never scroll the left edge past the chart end.
      if (vp.beatStart < 0) {
        vp.beatStart = 0;
        vp.beatEnd = beatWindow;
      } else if (vp.beatStart > maxBeat) {
        vp.beatStart = Math.max(0, maxBeat - beatWindow);
        vp.beatEnd = vp.beatStart + beatWindow;
      }

      // Build overlay lines from the timeline overlay system
      // Reuses the existing timelineOverlayLines state from editorStore
      const overlayData: OverlayLine[] = [];
      if (es.timelineOverlayEnabled && es.timelineOverlayLines.length > 0) {
        for (let oi = 0; oi < es.timelineOverlayLines.length; oi++) {
          const overlayIdx = es.timelineOverlayLines[oi];
          // Don't overlay the currently selected line on itself
          if (overlayIdx === lineIndex) continue;
          const overlayLine = cs.chart.lines[overlayIdx];
          if (overlayLine) {
            overlayData.push({
              events: overlayLine.events,
              color: seriesColor(oi),
              label: overlayLine.name,
            });
          }
        }
      }

      // Convert the id-based hovered keyframe (editorStore stores eventId so the
      // hover survives event re-sorts) back to the array index the renderer wants.
      const hk = es.curveEditorHoveredKeyframe;
      const hoveredKeyframeForRender = hk
        ? { eventIndex: events.findIndex((ev) => ev.id === hk.eventId), kind: hk.kind, handle: hk.handle }
        : null;

      renderCurveGraph(ctx, {
        events,
        visibleLanes: es.curveEditorVisibleLanes,
        viewport: vp,
        canvasWidth: w,
        canvasHeight: h,
        currentBeat,
        selectedEventIndices: getSelectedEventIndices(),
        hoveredKeyframe: hoveredKeyframeForRender,
        normalized: es.curveEditorNormalized,
        overlayLines: overlayData.length > 0 ? overlayData : undefined,
        overlayOpacity: es.timelineOverlayOpacity,
      });

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPopout]);

  // Mouse interactions
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const line = lineIndex !== null ? cs.chart.lines[lineIndex] : null;
    if (!line) return;

    const dragState = es.curveEditorDragState;
    if (dragState) {
      // Dragging a keyframe. dragState holds the event's stable id (L2); resolve
      // it to the current array index each move so a value-edit re-sort can't make
      // us write to the wrong event.
      const vp = viewportRef.current;
      const h = isPopout ? 400 : es.curveEditorHeight;
      const newValue = yToValue(mouseY, vp, h);

      const eventIndex = line.events.findIndex((ev) => ev.id === dragState.eventId);
      if (eventIndex < 0) return;
      const event = line.events[eventIndex];
      if (!event) return;

      if ("constant" in event.value) {
        cs.editEvent(lineIndex!, eventIndex, {
          value: { constant: newValue },
        });
      } else if ("transition" in event.value) {
        const tv = event.value.transition;
        if (dragState.handle === "start") {
          cs.editEvent(lineIndex!, eventIndex, {
            value: { transition: { start: newValue, end: tv.end, easing: tv.easing } },
          });
        } else {
          cs.editEvent(lineIndex!, eventIndex, {
            value: { transition: { start: tv.start, end: newValue, easing: tv.easing } },
          });
        }
      }
      return;
    }

    // Hover detection
    const h = isPopout ? 400 : es.curveEditorHeight;
    const w = rect.width;
    const hit = hitTestKeyframeDiamond(
      mouseX, mouseY, line.events, es.curveEditorVisibleLanes,
      viewportRef.current, w, h,
    );
    const hoverId = hit ? line.events[hit.eventIndex]?.id : undefined;
    es.setCurveEditorHoveredKeyframe(
      hit && hoverId ? { eventId: hoverId, kind: hit.kind, handle: hit.handle } : null,
    );
  }, [isPopout]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    const line = lineIndex !== null ? cs.chart.lines[lineIndex] : null;
    if (!line) return;

    const h = isPopout ? 400 : es.curveEditorHeight;
    const w = rect.width;

    const hit = hitTestKeyframeDiamond(
      mouseX, mouseY, line.events, es.curveEditorVisibleLanes,
      viewportRef.current, w, h,
    );

    if (hit) {
      const event = line.events[hit.eventIndex];
      const eventId = event?.id;
      if (!event || !eventId) return;

      // Select the event
      setEventSelectionByIndex([hit.eventIndex]);

      // Start drag — store the event's stable id so the drag survives re-sorts.
      let startValue = 0;
      if ("constant" in event.value) startValue = event.value.constant;
      else if ("transition" in event.value) {
        startValue = hit.handle === "start" ? event.value.transition.start : event.value.transition.end;
      }

      es.setCurveEditorDragState({
        eventId,
        kind: hit.kind,
        handle: hit.handle,
        startMouseX: mouseX,
        startMouseY: mouseY,
        startBeat: beatToFloat(hit.handle === "start" ? event.start_beat : event.end_beat),
        startValue,
      });
    }
  }, [isPopout]);

  const handleMouseUp = useCallback(() => {
    useEditorStore.getState().setCurveEditorDragState(null);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const es = useEditorStore.getState();
    const cs = useChartStore.getState();
    const lineIndex = getSelectedLineIndex();
    if (lineIndex === null) return;

    const h = isPopout ? 400 : es.curveEditorHeight;
    const w = rect.width;
    const vp = viewportRef.current;

    const beat = xToBeat(mouseX, vp, w);
    const value = yToValue(mouseY, vp, h);

    // Create a constant event at the clicked position for the first visible lane
    const activeLane = es.curveEditorVisibleLanes[0] || "x";
    cs.addEvent(lineIndex, {
      kind: activeLane,
      start_beat: floatToBeat(beat),
      end_beat: floatToBeat(beat + 1),
      value: { constant: value },
    });
  }, [isPopout]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const vp = viewportRef.current;

    if (e.ctrlKey || e.metaKey) {
      // Zoom X (beat axis)
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const beatCenter = (vp.beatStart + vp.beatEnd) / 2;
      const halfRange = ((vp.beatEnd - vp.beatStart) / 2) * factor;
      vp.beatStart = Math.max(0, beatCenter - halfRange);
      vp.beatEnd = beatCenter + halfRange;
    } else {
      // Zoom Y (value axis)
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const valueCenter = (vp.valueMin + vp.valueMax) / 2;
      const halfRange = ((vp.valueMax - vp.valueMin) / 2) * factor;
      vp.valueMin = valueCenter - halfRange;
      vp.valueMax = valueCenter + halfRange;
      useEditorStore.getState().setCurveEditorValueRange({ min: vp.valueMin, max: vp.valueMax });
    }
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: isPopout ? "100%" : height,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: hoveredKeyframe ? "grab" : "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />
    </div>
  );
}
