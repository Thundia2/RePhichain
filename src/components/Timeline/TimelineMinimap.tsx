// ============================================================
// Timeline Minimap — Note density overview with click-to-seek
// ============================================================

import { useRef, useEffect, useCallback } from "react";
import { useChartStore } from "../../stores/chartStore";
import { audioEngine } from "../../audio/audioEngine";
import { beatToFloat } from "../../types/chart";
import { BpmList } from "../../utils/bpmList";
import { getPlayheadBeat } from "../../utils/playhead";
import { chromeTheme, withAlpha } from "../../canvas/chromeTheme";

export function TimelineMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lines = useChartStore((s) => s.chart.lines);
  const bpmPoints = useChartStore((s) => s.chart.bpm_list);
  const offset = useChartStore((s) => s.chart.offset);

  // Render density + playhead.
  //
  // Z4: the note-density histogram is STATIC between edits — it only changes
  // when lines/bpm/offset change, which already re-runs this effect. The old
  // loop recomputed the whole per-note histogram (1918 notes on a dense chart)
  // and repainted every column at 60 Hz, even while paused. Now the histogram
  // is built once per effect run and pre-rendered to an offscreen canvas; the
  // rAF tick only blits it + draws the playhead, and is dirty-gated on the
  // playhead beat so an idle minimap does ~zero work. Can't go stale: density
  // refreshes via the deps array, the playhead via the beat compare.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // ---- Static layer: beat range + density histogram (built once) ----
    let maxBeat = 0;
    for (const line of lines) {
      for (const note of line.notes) {
        maxBeat = Math.max(maxBeat, beatToFloat(note.beat));
      }
      for (const event of line.events) {
        maxBeat = Math.max(maxBeat, beatToFloat(event.end_beat));
      }
    }
    if (maxBeat === 0) maxBeat = 100;

    const density = new Float32Array(width);
    for (const line of lines) {
      for (const note of line.notes) {
        const x = Math.floor((beatToFloat(note.beat) / maxBeat) * (width - 1));
        if (x >= 0 && x < width) density[x]++;
      }
    }
    let maxDensity = 0;
    for (let i = 0; i < width; i++) {
      if (density[i] > maxDensity) maxDensity = density[i];
    }
    if (maxDensity === 0) maxDensity = 1;

    // Pre-render the density bars + background to an offscreen canvas so the
    // per-frame cost is a single drawImage instead of `width` fillRects.
    const bg = document.createElement("canvas");
    bg.width = width;
    bg.height = height;
    const bgCtx = bg.getContext("2d");
    const t = chromeTheme();
    if (bgCtx) {
      bgCtx.fillStyle = t.bgSecondary;
      bgCtx.fillRect(0, 0, width, height);
      for (let x = 0; x < width; x++) {
        const intensity = density[x] / maxDensity;
        if (intensity > 0) {
          bgCtx.fillStyle = withAlpha(t.accentPrimary, Math.max(0.15, intensity));
          bgCtx.fillRect(x, 0, 1, height);
        }
      }
    }

    // ---- Dynamic layer: playhead, dirty-gated on the beat ----
    let raf: number;
    let lastBeat = NaN;
    function draw() {
      if (!canvas || !ctx) return;
      // Playhead — getState() inside the rAF draw tick, so raw (imperative) read.
      const currentBeat = getPlayheadBeat({ clampNonNegative: true });
      if (currentBeat !== lastBeat) {
        lastBeat = currentBeat;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(bg, 0, 0);
        const playheadX = (currentBeat / maxBeat) * width;
        ctx.fillStyle = t.indicatorColor;
        ctx.fillRect(playheadX - 1, 0, 2, height);
      }
      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [lines, bpmPoints, offset]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;

      let maxBeat = 0;
      const cs = useChartStore.getState();
      for (const line of cs.chart.lines) {
        for (const note of line.notes) {
          maxBeat = Math.max(maxBeat, beatToFloat(note.beat));
        }
        for (const event of line.events) {
          maxBeat = Math.max(maxBeat, beatToFloat(event.end_beat));
        }
      }
      if (maxBeat === 0) return;

      const targetBeat = fraction * maxBeat;
      const bpmList = new BpmList(cs.chart.bpm_list);
      const targetTime = bpmList.timeAtFloat(targetBeat) + cs.chart.offset;
      audioEngine.seek(targetTime);
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={16}
      style={{
        width: "100%",
        height: 16,
        borderBottom: "var(--rule) solid var(--border-color)",
        cursor: "pointer",
        display: "block",
        flexShrink: 0,
      }}
      onClick={handleClick}
    />
  );
}
