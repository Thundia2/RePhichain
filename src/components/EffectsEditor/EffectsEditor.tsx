// ============================================================
// Effects Editor — Manages prpr/Phira shader effects and video backgrounds
//
// Provides UI for:
//   - Adding/removing shader effects with built-in shader selector
//   - Editing effect start/end beats and uniform variables
//   - Adding/removing video backgrounds
//   - Importing/exporting extra.json
//
// Recent change: Added stable _id fields to effects/videos for React
// keys. Previously using array index as key caused state persistence
// bugs when items were deleted from the middle of the list.
// ============================================================

import { useState } from "react";
import { useChartStore } from "../../stores/chartStore";
import type { ShaderEffect, VideoBackground, ExtraConfig } from "../../types/extra";
import type { Beat } from "../../types/chart";
import { beatToFloat, floatToBeat } from "../../types/chart";
import { SHADER_DEFAULTS } from "../../canvas/shaders";
import { Plus, Trash2 } from "lucide-react";
import { Card, Toggle, EmptyState, INPUT_STYLE, SELECT_STYLE } from "../common/UIKit";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { SegmentedControl } from "../common/SegmentedControl";
import { safeParseNumber } from "../common/FormFields";

/** Field label above an input (caption, text-secondary). */
const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  color: "var(--text-secondary)",
  fontSize: "var(--fs-caption)",
  marginBottom: "var(--space-2)",
};

/** Numeric inputs use the mono face. */
const NUM_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  fontFamily: "var(--font-mono)",
};

const BUILTIN_SHADERS = [
  "chromatic", "circleBlur", "fisheye", "glitch", "grayscale",
  "noise", "pixel", "radialBlur", "shockwave", "vignette",
];

export function EffectsEditor() {
  const extraConfig = useChartStore((s) => s.extraConfig);
  const setExtraConfig = useChartStore((s) => s.setExtraConfig);
  const [activeTab, setActiveTab] = useState<"effects" | "videos">("effects");

  const effects = extraConfig.effects ?? [];
  const videos = extraConfig.videos ?? [];

  const updateConfig = (changes: Partial<ExtraConfig>) => {
    setExtraConfig({ ...extraConfig, ...changes });
  };

  // ---- Effect management ----
  const addEffect = () => {
    const newEffect: ShaderEffect = {
      _id: crypto.randomUUID(),
      start: [0, 0, 1],
      end: [4, 0, 1],
      shader: "chromatic",
      global: false,
      vars: {},
    };
    updateConfig({ effects: [...effects, newEffect] });
  };

  const removeEffect = (index: number) => {
    updateConfig({ effects: effects.filter((_, i) => i !== index) });
  };

  const updateEffect = (index: number, changes: Partial<ShaderEffect>) => {
    const updated = effects.map((e, i) => i === index ? { ...e, ...changes } : e);
    updateConfig({ effects: updated });
  };

  // ---- Video management ----
  const addVideo = () => {
    const newVideo: VideoBackground = {
      _id: crypto.randomUUID(),
      path: "bga.mp4",
      time: [0, 0, 1],
      scale: "cropCenter",
      alpha: 1.0,
      dim: 0.3,
    };
    updateConfig({ videos: [...videos, newVideo] });
  };

  const removeVideo = (index: number) => {
    updateConfig({ videos: videos.filter((_, i) => i !== index) });
  };

  const updateVideo = (index: number, changes: Partial<VideoBackground>) => {
    const updated = videos.map((v, i) => i === index ? { ...v, ...changes } : v);
    updateConfig({ videos: updated });
  };

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "var(--space-8)", fontSize: "var(--fs-body)" }}>
      {/* Tab selector */}
      <SegmentedControl
        role="tablist"
        label="Effects editor sections"
        block
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "effects", label: `Shader effects (${effects.length})` },
          { value: "videos", label: `Video backgrounds (${videos.length})` },
        ]}
        style={{ marginBottom: "var(--space-8)" }}
      />

      {activeTab === "effects" && (
        <div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={addEffect}
            style={{ marginBottom: "var(--space-8)" }}
          >
            Add shader effect
          </Button>

          {effects.map((effect, i) => (
            <EffectCard
              key={effect._id ?? i}
              effect={effect}
              index={i}
              onUpdate={(changes) => updateEffect(i, changes)}
              onRemove={() => removeEffect(i)}
            />
          ))}

          {effects.length === 0 && (
            <EmptyState>
              No shader effects. Click "Add shader effect" to create one.
            </EmptyState>
          )}
        </div>
      )}

      {activeTab === "videos" && (
        <div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={addVideo}
            style={{ marginBottom: "var(--space-8)" }}
          >
            Add video background
          </Button>

          {videos.map((video, i) => (
            <VideoCard
              key={video._id ?? i}
              video={video}
              index={i}
              onUpdate={(changes) => updateVideo(i, changes)}
              onRemove={() => removeVideo(i)}
            />
          ))}

          {videos.length === 0 && (
            <EmptyState>
              No video backgrounds. Click "Add video background" to create one.
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Effect Card ----

function EffectCard({
  effect,
  index,
  onUpdate,
  onRemove,
}: {
  effect: ShaderEffect;
  index: number;
  onUpdate: (changes: Partial<ShaderEffect>) => void;
  onRemove: () => void;
}) {
  const defaults = SHADER_DEFAULTS[effect.shader] ?? {};
  const varNames = Object.keys(defaults);

  return (
    <Card>
      <div style={{ padding: "var(--space-8) var(--space-10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-control)" }}>Effect {index + 1}</span>
          <IconButton icon={Trash2} label="Remove effect" size="md" danger onClick={onRemove} />
        </div>

        {/* Shader selector */}
        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={LABEL_STYLE}>Shader</label>
          <select
            value={effect.shader}
            onChange={(e) => onUpdate({ shader: e.target.value, vars: {} })}
            style={{
              ...SELECT_STYLE,
              display: "block",
              width: "100%",
            }}
          >
            {BUILTIN_SHADERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Start/End beats */}
        <div style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-4)" }}>
          <BeatInput label="Start" value={effect.start} onChange={(v) => onUpdate({ start: v })} />
          <BeatInput label="End" value={effect.end} onChange={(v) => onUpdate({ end: v })} />
        </div>

        {/* Global toggle */}
        <div style={{ marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <Toggle
            checked={effect.global ?? false}
            onChange={(v) => onUpdate({ global: v })}
            label="Global (affects UI elements)"
          />
          <span style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)" }}>
            Global (affects UI elements)
          </span>
        </div>

        {/* Shader variables */}
        {varNames.length > 0 && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <label style={LABEL_STYLE}>Variables</label>
            {varNames.map((name) => {
              const defaultVal = defaults[name];
              const currentVal = effect.vars?.[name];
              // E4: an animated var is an AnimationEvent[] (array of objects). Show a
              // read-only marker rather than a constant input — the input would display
              // the default and OVERWRITE the whole animation with a constant on edit.
              // Animated vars are edited in the keyframe editor (ShaderVarAnimEditor).
              const isAnimated = Array.isArray(currentVal) && typeof currentVal[0] === "object";
              const numVal = typeof currentVal === "number" ? currentVal :
                             typeof defaultVal === "number" ? defaultVal :
                             Array.isArray(defaultVal) ? 0 : 0;

              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-2)" }}>
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", minWidth: "80px" }}>{name}</span>
                  {isAnimated ? (
                    <span style={{ fontSize: "var(--fs-caption)", color: "var(--accent-primary)", flex: 1 }}>
                      Animated · {(currentVal as unknown[]).length} keyframe{(currentVal as unknown[]).length !== 1 ? "s" : ""}
                    </span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      value={numVal}
                      onChange={(e) => {
                        const n = safeParseNumber(e.target.value);
                        if (n === null) return;
                        const newVars = { ...(effect.vars ?? {}), [name]: n };
                        onUpdate({ vars: newVars });
                      }}
                      aria-label={name}
                      style={{
                        ...NUM_INPUT_STYLE,
                        flex: 1,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---- Video Card ----

function VideoCard({
  video,
  index,
  onUpdate,
  onRemove,
}: {
  video: VideoBackground;
  index: number;
  onUpdate: (changes: Partial<VideoBackground>) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div style={{ padding: "var(--space-8) var(--space-10)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-control)" }}>Video {index + 1}</span>
          <IconButton icon={Trash2} label="Remove video" size="md" danger onClick={onRemove} />
        </div>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <label style={LABEL_STYLE}>Path</label>
          <input
            type="text"
            value={video.path}
            onChange={(e) => onUpdate({ path: e.target.value })}
            style={{
              ...INPUT_STYLE,
              display: "block",
              width: "100%",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-4)" }}>
          <BeatInput label="Time" value={video.time ?? [0, 0, 1]} onChange={(v) => onUpdate({ time: v })} />
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Scale</label>
            <select
              value={video.scale ?? "cropCenter"}
              onChange={(e) => onUpdate({ scale: e.target.value as VideoBackground["scale"] })}
              style={{
                ...SELECT_STYLE,
                display: "block",
                width: "100%",
              }}
            >
              <option value="cropCenter">cropCenter</option>
              <option value="inside">inside</option>
              <option value="fit">fit</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-8)" }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Alpha</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={typeof video.alpha === "number" ? video.alpha : 1}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) onUpdate({ alpha: n }); }}
              style={{
                ...NUM_INPUT_STYLE,
                display: "block",
                width: "100%",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>Dim</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={typeof video.dim === "number" ? video.dim : 0}
              onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) onUpdate({ dim: n }); }}
              style={{
                ...NUM_INPUT_STYLE,
                display: "block",
                width: "100%",
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---- Beat Input ----

function BeatInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Beat;
  onChange: (beat: Beat) => void;
}) {
  const beatFloat = beatToFloat(value);

  return (
    <div style={{ flex: 1 }}>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type="number"
        step="0.25"
        value={beatFloat}
        onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) onChange(floatToBeat(n)); }}
        style={{
          ...NUM_INPUT_STYLE,
          display: "block",
          width: "100%",
        }}
      />
    </div>
  );
}
