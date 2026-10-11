// ============================================================
// Preset Panel — Grid of preset cards with curve previews
//
// Cards are filled (bg-active) buttons; category colours are the
// event-kind tokens of the channel each category mostly drives.
// Presets saved from the Preset builder ("New preset…") are listed
// first under "Custom" and can be deleted.
// ============================================================

import { useState, useMemo } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Icon } from "../common/Icon";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { Tooltip } from "../common/Tooltip";
import { showConfirm } from "../common/ConfirmDialog";
import { INPUT_STYLE } from "../common/UIKit";
import { EVENT_KIND_META } from "../../constants/eventConfig";
import { BUILTIN_PRESETS } from "../../presets/builtinPresets";
import { applyPresetAtPlayhead } from "../../utils/applyPreset";
import { useSelectedLineIndex } from "../../stores/selection";
import { useSettingsStore } from "../../stores/settingsStore";
import { PresetBuilder } from "./PresetBuilder";
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

/** Filter value for the user's own presets (not a preset category). */
const CUSTOM_FILTER = "custom";

export function PresetPanel() {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const selectedLineIndex = useSelectedLineIndex();
  const customPresets = useSettingsStore((s) => s.customPresets);
  const removeCustomPreset = useSettingsStore((s) => s.removeCustomPreset);

  const customIds = useMemo(() => new Set(customPresets.map((p) => p.id)), [customPresets]);
  const allPresets = useMemo(() => [...customPresets, ...BUILTIN_PRESETS], [customPresets]);
  // The Custom chip disappears with the last custom preset, so its filter does too.
  const activeFilter = filter === CUSTOM_FILTER && customPresets.length === 0 ? null : filter;

  const filtered = useMemo(() => {
    let presets = allPresets;
    if (activeFilter === CUSTOM_FILTER) {
      presets = presets.filter((p) => customIds.has(p.id));
    } else if (activeFilter) {
      presets = presets.filter((p) => p.category === activeFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      presets = presets.filter(
        (p) => p.name.toLowerCase().includes(lower) || p.description.toLowerCase().includes(lower),
      );
    }
    return presets;
  }, [allPresets, customIds, activeFilter, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allPresets) {
      if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [allPresets]);

  const handleApply = (preset: EventPreset) => {
    if (selectedLineIndex === null) return;
    applyPresetAtPlayhead(selectedLineIndex, preset);
  };

  const handleDelete = async (preset: EventPreset) => {
    if (await showConfirm("The preset is removed from this list. Events it already added stay.", {
      title: `Delete "${preset.name}"?`,
      confirmLabel: "Delete preset",
      danger: true,
    })) {
      removeCustomPreset(preset.id);
    }
  };

  const filterChip = (key: string | null, label: string, count: number, color?: string) => {
    const active = activeFilter === key;
    return (
      <button
        key={key ?? "all"}
        type="button"
        className="ui-hover px-1.5 py-0 rounded text-xs"
        aria-pressed={active}
        style={{
          backgroundColor: active
            ? color ? `color-mix(in srgb, ${color} 15%, transparent)` : "var(--bg-active)"
            : undefined,
          color: active ? color ?? "var(--text-primary)" : undefined,
          border: "none",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
        }}
        onClick={() => setFilter(active || key === null ? null : key)}
      >
        {label} ({count})
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full text-xs" style={{ overflow: "hidden" }}>
      {/* Search bar + new preset */}
      <div className="flex items-center gap-2 px-2 py-1 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <Icon
            icon={Search}
            size={12}
            style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none" }}
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
        <Button size="sm" icon={Plus} onClick={() => setBuilderOpen(true)}>
          New preset…
        </Button>
      </div>

      {/* Category filter */}
      <div
        className="flex items-center gap-1 px-2 py-1 border-b flex-wrap"
        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
      >
        {filterChip(null, "All", allPresets.length)}
        {customPresets.length > 0 && filterChip(CUSTOM_FILTER, "Custom", customPresets.length, "var(--accent-primary)")}
        {Object.entries(CATEGORY_LABELS).map(([key, label]) =>
          filterChip(key, label, categoryCounts[key] || 0, CATEGORY_COLORS[key]),
        )}
      </div>

      {/* Preset grid */}
      <div
        className="flex-1 overflow-y-auto p-2"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-8)", alignContent: "start" }}
      >
        {filtered.map((preset) => {
          const custom = customIds.has(preset.id);
          const card = (
          <Tooltip key={preset.id} content={preset.description || preset.name}>
            <div
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
            >
              <PresetCurvePreview preset={preset} width={120} height={36} />
              <div
                style={{
                  fontSize: "var(--fs-control)",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginTop: "var(--space-4)",
                  overflowWrap: "anywhere",
                }}
              >
                {preset.name}
              </div>
              {preset.description && (
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>
                  {preset.description}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-4)",
                  marginTop: "var(--space-4)",
                  // Room for the delete button in a custom card's bottom-right corner.
                  minHeight: custom ? 20 : undefined,
                  paddingRight: custom ? "var(--space-24)" : undefined,
                }}
              >
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
          </Tooltip>
          );
          if (!custom) return card;
          // The delete button sits beside the card (not inside it): a button can't nest in role="button".
          return (
            <div key={preset.id} style={{ position: "relative" }}>
              {card}
              <IconButton
                icon={Trash2}
                label={`Delete preset "${preset.name}"`}
                size="sm"
                danger
                tooltipPosition="left"
                onClick={() => handleDelete(preset)}
                style={{ position: "absolute", bottom: "var(--space-6)", right: "var(--space-6)" }}
              />
            </div>
          );
        })}
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

      {builderOpen && <PresetBuilder onClose={() => setBuilderOpen(false)} />}
    </div>
  );
}
