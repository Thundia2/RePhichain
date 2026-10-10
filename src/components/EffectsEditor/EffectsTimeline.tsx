// ============================================================
// Effects Timeline -- Canvas-based swimlane visualization
//
// Renders shader effects as colored bars on horizontal lanes,
// one lane per unique shader type. Features:
//   - Beat grid background with numbered major lines
//   - Playhead (indicator colour) synced to audio position
//   - Click to select effect
//   - Ctrl+Scroll to zoom, Alt+Drag or middle-click to pan
//   - Lane labels with color dots on left
//
// Chrome (backgrounds, grid, labels, playhead) comes from chromeTheme;
// the per-shader lane colours are data colours.
// ============================================================

import { useRef, useEffect, useCallback, useState } from "react";
import { useAudioStore } from "../../stores/audioStore";
import type { ShaderEffect } from "../../types/extra";
import { beatToFloat } from "../../types/chart";
import { getPlayheadBeat } from "../../utils/playhead";
import { chromeTheme, monoFont, sansFont, withAlpha } from "../../canvas/chromeTheme";

// ---- Lane color palette (one per shader type) ----
const LANE_COLORS: Record<string, string> = {
  chromatic: "#e06c75",
  circleBlur: "#61afef",
  fisheye: "#c678dd",
  glitch: "#e5c07b",
  grayscale: "#abb2bf",
  noise: "#d19a66",
  pixel: "#56b6c2",
  radialBlur: "#98c379",
  shockwave: "#be5046",
  vignette: "#c882e7",
};

function getLaneColor(shader: string): string {
  if (LANE_COLORS[shader]) return LANE_COLORS[shader];
  // Deterministic hash color for custom shaders
  let hash = 0;
  for (let i = 0; i < shader.length; i++) {
    hash = ((hash << 5) - hash + shader.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

// ---- Constants ----
const LANE_HEIGHT = 28;
const LANE_LABEL_WIDTH = 90;
const HEADER_HEIGHT = 20;
const MIN_BEAT_ZOOM = 10;   // px per beat minimum
const MAX_BEAT_ZOOM = 300;  // px per beat maximum
const DEFAULT_BEAT_ZOOM = 40;

interface EffectsTimelineProps {
  effects: ShaderEffect[];
  selectedIndex: number | null;
  onSelectEffect: (index: number) => void;
}

export function EffectsTimeline({
  effects,
  selectedIndex,
  onSelectEffect,
}: EffectsTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // View state
  const [beatZoom, setBeatZoom] = useState(DEFAULT_BEAT_ZOOM); // px per beat
  const [scrollX, setScrollX] = useState(0); // px offset (beat 0 position)
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, scrollX: 0 });

  // Audio time for playhead (subscribed → drives the canvas redraw)
  const currentTime = useAudioStore((s) => s.currentTime);

  // Build unique lane list (sorted by first appearance order)
  const laneOrder = buildLaneOrder(effects);
  const totalHeight = HEADER_HEIGHT + laneOrder.length * LANE_HEIGHT;

  // Playhead beat via the central helper, so it subtracts chart.offset like the
  // effect bars (which are positioned by chart beat). The old inline form
  // `beatAtFloat(currentTime)` dropped the offset, putting the playhead `offset`
  // beats off from the bars (finding T3 / L6).
  const currentBeat = getPlayheadBeat({ time: currentTime });

  // ---- Drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Size the canvas backing store to match CSS size at DPR
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = chromeTheme();

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = t.bgPrimary;
    ctx.fillRect(0, 0, w, h);

    const contentX = LANE_LABEL_WIDTH;
    const contentW = w - contentX;
    if (contentW <= 0) return;

    // ---- Beat grid ----
    drawBeatGrid(ctx, contentX, HEADER_HEIGHT, contentW, h - HEADER_HEIGHT, beatZoom, scrollX);

    // ---- Lane backgrounds ----
    for (let i = 0; i < laneOrder.length; i++) {
      const y = HEADER_HEIGHT + i * LANE_HEIGHT;
      ctx.fillStyle = i % 2 === 0 ? withAlpha(t.fillHover, 0.02) : withAlpha(t.canvasBg, 0.02);
      ctx.fillRect(contentX, y, contentW, LANE_HEIGHT);
    }

    // ---- Lane dividers ----
    ctx.strokeStyle = t.separator;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= laneOrder.length; i++) {
      const y = HEADER_HEIGHT + i * LANE_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(contentX, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // ---- Effect bars ----
    for (let i = 0; i < effects.length; i++) {
      const eff = effects[i];
      const laneIdx = laneOrder.indexOf(eff.shader);
      if (laneIdx < 0) continue;

      const startBeat = beatToFloat(eff.start);
      const endBeat = beatToFloat(eff.end);
      const x1 = contentX + (startBeat * beatZoom - scrollX);
      const x2 = contentX + (endBeat * beatZoom - scrollX);
      const y = HEADER_HEIGHT + laneIdx * LANE_HEIGHT + 3;
      const barH = LANE_HEIGHT - 6;

      // Clip to visible area
      if (x2 < contentX || x1 > w) continue;

      const clippedX1 = Math.max(contentX, x1);
      const clippedX2 = Math.min(w, x2);
      const barW = clippedX2 - clippedX1;
      if (barW < 1) continue;

      const color = getLaneColor(eff.shader);
      const isSelected = i === selectedIndex;

      // Bar fill
      ctx.fillStyle = isSelected ? color : hexToRgba(color, 0.65);
      ctx.beginPath();
      roundRect(ctx, clippedX1, y, barW, barH, 4);
      ctx.fill();

      // Selected outline
      if (isSelected) {
        ctx.strokeStyle = t.textPrimary;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRect(ctx, clippedX1, y, barW, barH, 4);
        ctx.stroke();
      }

      // Label inside bar if wide enough
      if (barW > 40) {
        ctx.fillStyle = isSelected ? t.onAccent : withAlpha(t.onAccent, 0.85);
        ctx.font = monoFont(10, 600);
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.beginPath();
        ctx.rect(clippedX1 + 2, y, barW - 4, barH);
        ctx.clip();
        ctx.fillText(
          `${startBeat.toFixed(1)}-${endBeat.toFixed(1)}`,
          clippedX1 + 4,
          y + barH / 2,
        );
        ctx.restore();
      }
    }

    // ---- Lane labels (left side) ----
    ctx.fillStyle = t.bgSecondary;
    ctx.fillRect(0, 0, LANE_LABEL_WIDTH, h);

    // Header label
    ctx.fillStyle = t.textSecondary;
    ctx.font = sansFont(10, 600);
    ctx.textBaseline = "middle";
    ctx.fillText("Shader", 6, HEADER_HEIGHT / 2);

    for (let i = 0; i < laneOrder.length; i++) {
      const shader = laneOrder[i];
      const y = HEADER_HEIGHT + i * LANE_HEIGHT;
      const color = getLaneColor(shader);

      // Color dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(10, y + LANE_HEIGHT / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Name
      ctx.fillStyle = t.textSecondary;
      ctx.font = sansFont(11, 500);
      ctx.textBaseline = "middle";
      ctx.fillText(shader, 20, y + LANE_HEIGHT / 2);
    }

    // Divider between labels and content
    ctx.strokeStyle = t.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LANE_LABEL_WIDTH, 0);
    ctx.lineTo(LANE_LABEL_WIDTH, h);
    ctx.stroke();

    // ---- Playhead ----
    const playheadX = contentX + (currentBeat * beatZoom - scrollX);
    if (playheadX >= contentX && playheadX <= w) {
      ctx.strokeStyle = t.indicatorColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = t.indicatorColor;
      ctx.beginPath();
      ctx.moveTo(playheadX - 4, 0);
      ctx.lineTo(playheadX + 4, 0);
      ctx.lineTo(playheadX, 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [effects, laneOrder, beatZoom, scrollX, currentBeat, selectedIndex]);

  // ---- Animation loop ----
  //
  // Z4: `draw` is memoized on ALL of its inputs (effects/laneOrder/beatZoom/
  // scrollX/currentBeat/selectedIndex), and currentBeat derives from the
  // SUBSCRIBED currentTime — so any change that affects the picture recreates
  // `draw` and re-runs this effect. Between those, the old loop redrew the same
  // closed-over inputs 60×/sec (identical pixels), even while paused. Now the
  // loop is dirty-gated: it redraws once per effect run (lastSig resets to "")
  // and otherwise only when the canvas's CSS size changes (the one redraw
  // trigger that doesn't go through React). Idle ⇒ a clientWidth read + string
  // compare, no canvas work.
  useEffect(() => {
    let rafId = 0;
    let lastSig = "";
    const tick = () => {
      const canvas = canvasRef.current;
      const sig = canvas ? `${canvas.clientWidth}x${canvas.clientHeight}` : "";
      if (sig !== lastSig) {
        lastSig = sig;
        draw();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  // ---- Resize observer ----
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(() => {
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = Math.max(totalHeight, 60) + "px";
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [totalHeight]);

  // ---- Wheel zoom ----
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - LANE_LABEL_WIDTH;

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
        const newZoom = Math.max(MIN_BEAT_ZOOM, Math.min(MAX_BEAT_ZOOM, beatZoom * zoomFactor));

        // Zoom toward mouse position
        const beatAtMouse = (mouseX + scrollX) / beatZoom;
        const newScrollX = beatAtMouse * newZoom - mouseX;

        setBeatZoom(newZoom);
        setScrollX(Math.max(0, newScrollX));
      } else {
        // Horizontal pan
        setScrollX((prev) => Math.max(0, prev + e.deltaY * 0.5));
      }
    },
    [beatZoom, scrollX],
  );

  // ---- Click to select ----
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (isPanning) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Must be in content area
      if (mx < LANE_LABEL_WIDTH || my < HEADER_HEIGHT) return;

      const clickBeat = ((mx - LANE_LABEL_WIDTH) + scrollX) / beatZoom;
      const laneIdx = Math.floor((my - HEADER_HEIGHT) / LANE_HEIGHT);

      if (laneIdx < 0 || laneIdx >= laneOrder.length) return;
      const targetShader = laneOrder[laneIdx];

      // Find the effect at this beat in this lane
      for (let i = 0; i < effects.length; i++) {
        const eff = effects[i];
        if (eff.shader !== targetShader) continue;
        const startBeat = beatToFloat(eff.start);
        const endBeat = beatToFloat(eff.end);
        if (clickBeat >= startBeat && clickBeat <= endBeat) {
          onSelectEffect(i);
          return;
        }
      }
    },
    [effects, laneOrder, beatZoom, scrollX, isPanning, onSelectEffect],
  );

  // ---- Drag to pan ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1 && !(e.button === 0 && e.altKey)) return; // middle-click or alt+click
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, scrollX };
    },
    [scrollX],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      setScrollX(Math.max(0, panStartRef.current.scrollX - dx));
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) setIsPanning(false);
  }, [isPanning]);

  if (effects.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        overflow: "hidden",
        borderRadius: "var(--radius-md)",
        border: "var(--rule) solid var(--border-color)",
        marginTop: "var(--space-8)",
        cursor: isPanning ? "grabbing" : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display: "block",
          width: "100%",
          height: Math.max(totalHeight, 60),
        }}
      />
      {/* Zoom indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-2) var(--space-6)",
          fontSize: "var(--fs-caption)",
          color: "var(--text-secondary)",
          backgroundColor: "var(--bg-secondary)",
          borderTop: "var(--rule) solid var(--border-color)",
        }}
      >
        <span>Ctrl+Scroll to zoom · Alt+Drag to pan</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{beatZoom.toFixed(0)} px/beat</span>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

/** Build ordered list of unique shader names from effects */
function buildLaneOrder(effects: ShaderEffect[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const eff of effects) {
    if (!seen.has(eff.shader)) {
      seen.add(eff.shader);
      order.push(eff.shader);
    }
  }
  return order;
}

/** Draw beat grid lines */
function drawBeatGrid(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  beatZoom: number,
  scrollX: number,
) {
  const firstBeat = Math.floor(scrollX / beatZoom);
  const lastBeat = Math.ceil((scrollX + width) / beatZoom);

  const t = chromeTheme();
  for (let beat = firstBeat; beat <= lastBeat; beat++) {
    const x = x0 + (beat * beatZoom - scrollX);
    if (x < x0 || x > x0 + width) continue;

    const isMajor = beat % 4 === 0;
    ctx.strokeStyle = isMajor ? withAlpha(t.beatLinePrimary, 0.12) : withAlpha(t.beatLineSecondary, 0.04);
    ctx.lineWidth = isMajor ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + height);
    ctx.stroke();

    // Beat number labels at top
    if (isMajor || beatZoom > 60) {
      ctx.fillStyle = t.textSecondary;
      ctx.font = monoFont(10);
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillText(String(beat), x, y0 - 16);
    }
  }
}

/** Lane colour (hex or hsl) at `alpha` opacity */
function hexToRgba(hex: string, alpha: number): string {
  // Handle HSL colors
  if (hex.startsWith("hsl")) return hex.replace(")", `, ${alpha})`).replace("hsl", "hsla");
  // Handle hex
  return withAlpha(hex, alpha);
}

/** Canvas 2D rounded rectangle helper */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
