// ============================================================
// Mini Game Preview — Small inset game preview canvas
//
// Rendered as an absolute-positioned overlay in the top-right
// corner of the UnrolledCanvas. Uses a second GameRenderer
// instance at low resolution (160×120) to show the selected
// line in its actual game-space position/rotation with notes
// falling toward the line.
//
// Read-only — no mouse interaction. Toggleable via the
// showMiniPreview state in editorStore (G key in unrolled mode).
//
// Recent change: Created as part of the Unrolled Editor feature.
// ============================================================

import { useRef, useEffect, useMemo } from "react";
import { useChartStore } from "../../stores/chartStore";
import { useAudioStore } from "../../stores/audioStore";
import {
  getSelectedLineIndex,
  getSelectedNoteIndices,
} from "../../stores/selection";
import { useSettingsStore } from "../../stores/settingsStore";
import { GameRenderer } from "../../canvas/gameRenderer";
import { BpmList } from "../../utils/bpmList";
import { playbackOffsetSeconds } from "../../utils/playhead";

// ============================================================
// Configurable dimensions for the mini preview
// ============================================================
const MINI_WIDTH = 160;
const MINI_HEIGHT = 120;

export function MiniGamePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const rafRef = useRef<number>(0);

  const chart = useChartStore((s) => s.chart);
  const isLoaded = useChartStore((s) => s.isLoaded);
  const bpmList = useMemo(() => new BpmList(chart.bpm_list), [chart.bpm_list]);
  const bpmListRef = useRef(bpmList);
  useEffect(() => { bpmListRef.current = bpmList; }, [bpmList]);

  // ---- Initialize renderer + animation loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas resolution (no DPR scaling — it's a small preview)
    canvas.width = MINI_WIDTH;
    canvas.height = MINI_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    rendererRef.current = new GameRenderer(ctx);

    const animate = () => {
      const renderer = rendererRef.current;
      if (!renderer) { rafRef.current = requestAnimationFrame(animate); return; }

      const cs = useChartStore.getState();
      const as_ = useAudioStore.getState();
      const ss = useSettingsStore.getState();

      if (!cs.isLoaded) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const bl = bpmListRef.current;
      const currentTime = as_.currentTime;

      // Audio latency compensation for game preview visuals
      const effectiveOffset = playbackOffsetSeconds(true);

      renderer.render(
        cs.chart.lines,
        bl,
        currentTime,
        effectiveOffset,
        MINI_WIDTH,
        MINI_HEIGHT,
        {
          noteSize: ss.noteSize,
          backgroundDim: ss.backgroundDim,
          illustrationImage: cs.illustrationImage,
          selectedLineIndex: getSelectedLineIndex(),
          selectedNoteIndices: getSelectedNoteIndices(),
          showFcApIndicator: false,
          isFcValid: false,
          multiHighlight: false,
          anchorMarkerVisibility: "never",
          showHud: false,
          hideNotes: false,
        },
      );

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isLoaded]);

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: MINI_WIDTH,
        height: MINI_HEIGHT,
        borderRadius: "var(--radius-lg)",
        border: "var(--rule) solid var(--border-color)",
        overflow: "hidden",
        background: "var(--canvas-bg)",
        boxShadow: "var(--shadow-popover)",
        pointerEvents: "none", // read-only — clicks pass through
        zIndex: "var(--z-raised)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MINI_WIDTH,
          height: MINI_HEIGHT,
          display: "block",
        }}
      />
      {/* Label at the bottom */}
      <span
        style={{
          position: "absolute",
          bottom: 2,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: "var(--fs-caption)",
          color: "var(--text-secondary)",
          pointerEvents: "none",
        }}
      >
        Game preview
      </span>
    </div>
  );
}
