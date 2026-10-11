// ============================================================
// Preset Step — Step 2 of Favorites Wizard
// Categorized list of presets with checkboxes
// ============================================================

import { Check } from "lucide-react";
import { useFavoritesStore } from "../../../stores/favoritesStore";
import { Icon } from "../../common/Icon";
import { Badge } from "../../common/UIKit";
import { BUILTIN_PRESETS } from "../../../presets/builtinPresets";

// Category dots reuse the event-kind tokens closest to each category.
const CATEGORY_COLORS: Record<string, string> = {
  movement: "var(--event-speed)",
  visibility: "var(--event-opacity)",
  rotation: "var(--event-rotation)",
  speed: "var(--event-y)",
  compound: "var(--event-scale-x)",
};

/** "movement" → "Movement" (sentence case for stored lowercase ids). */
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CATEGORY_ORDER = ["movement", "visibility", "rotation", "speed", "compound"];

export function PresetStepList() {
  const favoritePresets = useFavoritesStore((s) => s.favoritePresetIds);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavoritePreset);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    presets: BUILTIN_PRESETS.filter((p) => p.category === cat),
  })).filter((g) => g.presets.length > 0);

  return (
    <div>
      <div style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", marginBottom: "var(--space-10)" }}>
        Select your favorite presets. They'll appear at the top of preset lists for quick application.
      </div>

      {grouped.map(({ category, presets }) => (
        <div key={category} style={{ marginBottom: "var(--space-12)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-6)",
              padding: "var(--space-4) 0",
              marginBottom: "var(--space-4)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: CATEGORY_COLORS[category] ?? "var(--text-muted)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "var(--fs-control)",
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              {sentenceCase(category)}
            </span>
          </div>

          <div style={{ background: "var(--bg-active)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            {presets.map((preset, i) => {
              const selected = favoritePresets.includes(preset.id);
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  className="ui-hover"
                  onClick={() => toggleFavorite(preset.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-8)",
                    width: "100%",
                    padding: "var(--space-8) var(--space-10)",
                    border: "none",
                    borderBottom: i < presets.length - 1 ? "var(--rule) solid var(--separator)" : "none",
                    background: selected ? "var(--accent-wash)" : undefined,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "var(--radius-xs)",
                      border: selected
                        ? "none"
                        : "var(--rule) solid var(--text-muted)",
                      background: selected ? "var(--accent-primary)" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--on-accent)",
                    }}
                  >
                    {selected && <Icon icon={Check} size={12} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)", marginBottom: 1 }}>
                      {preset.name}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--fs-caption)",
                        color: "var(--text-secondary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {preset.description}
                    </div>
                  </div>

                  {/* Category badge */}
                  <Badge color={CATEGORY_COLORS[category] ?? "var(--text-secondary)"}>
                    {sentenceCase(category)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
