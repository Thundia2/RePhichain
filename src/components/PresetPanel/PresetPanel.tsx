// ============================================================
// Preset Panel — Grid of preset cards with curve previews
//
// Cards are filled (bg-active) buttons; category colours are the
// event-kind tokens of the channel each category mostly drives.
// ============================================================

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Icon } from "../common/Icon";
import { INPUT_STYLE } from "../common/UIKit";
import { EVENT_KIND_META } from "../../constants/eventConfig";
import { BUILTIN_PRESETS } from "../../presets/builtinPresets";
import { applyPresetAtPlayhead } from "../../utils/applyPreset";
import { useSelectedLineIndex } from "../../stores/selection";
import { PresetCurvePreview } from "./PresetCurvePreview";
import type { EventPreset } from "../../types/preset";

const CATEGORY_LABELS: Record<string, string> = {
  movement: "Movement",
  visibility: "Visibility",
  rotation: "Rotation",
  speed: "Speed",
  compound: "Compound",
};

const CATEGORY_COLORS: Record<string, string> = {
  movement: "var(--event-x)",
  visibility: "var(--event-opacity)",
  rotation: "var(--event-rotation)",
  speed: "var(--event-speed)",
  compound: "var(--event-y)",
};

export function PresetPanel() {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const selectedLineIndex = useSelectedLineIndex();

  const filtered = useMemo(() => {
    let presets = BUILTIN_PRESETS;
    if (filter) {
      presets = presets.filter((p) => p.category === filter);
    }
    if (search) {
      const lower = search.toLowerCase();
      presets = presets.filter(
        (p) => p.name.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower),
      );
    }
    return presets;
  }, [filter, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of BUILTIN_PRESETS) {
      const cat = p.category ?? "compound";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, []);

  const handleApply = (preset: EventPreset) => {
    if (selectedLineIndex === null) return;
    applyPresetAtPlayhead(selectedLineIndex, preset);
  };

  return (
    <div className="flex flex-col h-full text-xs" style={{ overflow: "hidden" }}>
      {/* Search bar */}
      <div className="px-2 py-1 border-b" style={{ borderColor: "var(--border-color)", position: "relative" }}>
        <Icon
          icon={Search}
          size={12}
          style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none" }}
        />
        <input
          type="text"
          placeholder="Search presets…"
          aria-label="Search presets"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            ...INPUT_STYLE,
            width: "100%",
            paddingLeft: 24,
          }}
        />
      </div>

      {/* Category filter */}
      <div
        className="flex items-center gap-1 px-2 py-1 border-b flex-wrap"
        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
      >
        <button
          type="button"
          className="ui-hover px-1.5 py-0 rounded text-xs"
          aria-pressed={filter === null}
          style={{
            backgroundColor: filter === null ? "var(--bg-active)" : undefined,
            color: filter === null ? "var(--text-primary)" : undefined,
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
          onClick={() => setFilter(null)}
        >
          All ({BUILTIN_PRESETS.length})
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="ui-hover px-1.5 py-0 rounded text-xs"
            aria-pressed={filter === key}
            style={{
              backgroundColor: filter === key
                ? `color-mix(in srgb, ${CATEGORY_COLORS[key]} 15%, transparent)`
                : undefined,
              color: filter === key ? CATEGORY_COLORS[key] : undefined,
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
            onClick={() => setFilter(filter === key ? null : key)}
          >
            {label} ({categoryCounts[key] || 0})
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div
        className="flex-1 overflow-y-auto p-2"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-8)", alignContent: "start" }}
      >
        {filtered.map((preset) => (
          <div
            key={preset.id}
            role="button"
            tabIndex={0}
            aria-disabled={selectedLineIndex === null}
            style={{
              backgroundColor: "var(--bg-active)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-8)",
              cursor: selectedLineIndex !== null ? "pointer" : "not-allowed",
              opacity: selectedLineIndex !== null ? 1 : "var(--opacity-disabled)",
            }}
            onClick={() => handleApply(preset)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleApply(preset);
              }
            }}
            title={preset.description}
          >
            <PresetCurvePreview preset={preset} width={120} height={36} />
            <div style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)", marginTop: "var(--space-4)" }}>
              {preset.name}
            </div>
            <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
              {preset.description}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
              {preset.channels.map((ch) => (
                <span
                  key={ch}
                  style={{
                    fontSize: "var(--fs-badge)",
                    lineHeight: "12px",
                    padding: "1px var(--space-6)",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: `color-mix(in srgb, ${CATEGORY_COLORS[preset.category ?? "compound"]} 14%, transparent)`,
                    color: CATEGORY_COLORS[preset.category ?? "compound"],
                    fontWeight: 600,
                  }}
                >
                  {EVENT_KIND_META[ch]?.label ?? ch}
                </span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ color: "var(--text-secondary)", gridColumn: "1 / -1", textAlign: "center", padding: "var(--space-16)" }}>
            No presets match your search
          </div>
        )}
      </div>

      {selectedLineIndex === null && (
        <div
          className="px-2 py-1 border-t"
          style={{ borderColor: "var(--border-color)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)", textAlign: "center" }}
        >
          Select a line to apply presets
        </div>
      )}
    </div>
  );
}
