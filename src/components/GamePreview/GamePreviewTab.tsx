// ============================================================
// Game Preview Tab — Standalone preview with aspect ratio presets
//
// When the Preview panel is "double-expanded" (opened as a tab),
// this wrapper renders the GamePreview canvas constrained to a
// chosen aspect ratio, picked from a segmented control of presets.
//
// Presets: 1:1, 16:9, 3:2, 21:9, 20:9, Custom (free-form)
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { GamePreview } from "./GamePreview";
import { SegmentedControl } from "../common/SegmentedControl";
import { INPUT_STYLE } from "../common/UIKit";

interface AspectPreset {
  label: string;
  /** width / height ratio, or null for "fill container" */
  ratio: number | null;
}

const PRESETS: AspectPreset[] = [
  { label: "Fill", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "21:9", ratio: 21 / 9 },
  { label: "20:9", ratio: 20 / 9 },
];

export function GamePreviewTab() {
  const [activePreset, setActivePreset] = useState<string>("Fill");
  const [customW, setCustomW] = useState("16");
  const [customH, setCustomH] = useState("9");
  const [showCustom, setShowCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compute the active aspect ratio
  const getActiveRatio = useCallback((): number | null => {
    if (activePreset === "Custom") {
      const w = parseFloat(customW);
      const h = parseFloat(customH);
      if (w > 0 && h > 0) return w / h;
      return null;
    }
    const preset = PRESETS.find((p) => p.label === activePreset);
    return preset?.ratio ?? null;
  }, [activePreset, customW, customH]);

  const ratio = getActiveRatio();

  // Compute preview size within the container, respecting aspect ratio
  let previewStyle: React.CSSProperties;
  if (ratio === null || containerSize.w === 0 || containerSize.h === 0) {
    previewStyle = { width: "100%", height: "100%" };
  } else {
    const containerRatio = containerSize.w / containerSize.h;
    if (containerRatio > ratio) {
      // Container is wider → constrain by height
      const h = containerSize.h;
      const w = h * ratio;
      previewStyle = {
        width: `${w}px`,
        height: `${h}px`,
      };
    } else {
      // Container is taller → constrain by width
      const w = containerSize.w;
      const h = w / ratio;
      previewStyle = {
        width: `${w}px`,
        height: `${h}px`,
      };
    }
  }

  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE,
    width: 36,
    padding: "0 var(--space-4)",
    textAlign: "center",
    fontFamily: "var(--font-mono)",
  };

  const presetOptions = [
    ...PRESETS.map((p) => ({ value: p.label, label: p.label })),
    { value: "Custom", label: "Custom" },
  ];

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: "var(--canvas-bg)" }}>
      {/* Aspect ratio toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          padding: "var(--space-4) var(--space-8)",
          flexShrink: 0,
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "var(--rule) solid var(--border-color)",
        }}
      >
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>
          Aspect ratio
        </span>
        <SegmentedControl
          label="Aspect ratio"
          size="sm"
          tone="accent"
          options={presetOptions}
          value={activePreset}
          onChange={(v) => {
            setActivePreset(v);
            setShowCustom(v === "Custom");
          }}
        />
        {showCustom && activePreset === "Custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <input
              style={inputStyle}
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              aria-label="Width ratio"
              title="Width ratio"
            />
            <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>:</span>
            <input
              style={inputStyle}
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              aria-label="Height ratio"
              title="Height ratio"
            />
          </div>
        )}

        {/* Show computed resolution */}
        {ratio !== null && containerSize.w > 0 && (
          <span
            style={{
              marginLeft: "auto",
              color: "var(--text-secondary)",
              fontSize: "var(--fs-caption)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {Math.round(parseFloat(previewStyle.width as string) || containerSize.w)}
            {" × "}
            {Math.round(parseFloat(previewStyle.height as string) || containerSize.h)}
          </span>
        )}
      </div>

      {/* Preview container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
      >
        <div style={previewStyle}>
          <GamePreview />
        </div>
      </div>
    </div>
  );
}
