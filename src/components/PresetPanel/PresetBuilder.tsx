// ============================================================
// Compound Preset Builder
//
// A dialog for creating custom multi-channel event presets.
// Users can select channels, add keyframes on a visual strip,
// set values and easings, then save to customPresets.
// Rendered in the shared Dialog chrome.
// ============================================================

import { useState, useCallback, useRef } from "react";
import { Trash2, SlidersHorizontal } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import type { EventPreset, EventTemplate } from "../../types/preset";
import type { LineEventKind, EasingType } from "../../types/chart";
import { floatToBeat } from "../../types/chart";
import { EASING_OPTIONS, NumericInput } from "../common/FormFields";
import { INPUT_STYLE, SELECT_STYLE } from "../common/UIKit";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Tooltip } from "../common/Tooltip";

// ============================================================
// Types
// ============================================================

interface Keyframe {
  /** Unique id within the channel */
  id: string;
  /** Beat offset from the preset start */
  beatOffset: number;
  /** Value at this keyframe */
  value: number;
  /** Whether to use $CURRENT instead of a fixed value */
  useCurrent: boolean;
  /** Easing to the next keyframe */
  easing: EasingType;
}

interface ChannelState {
  kind: LineEventKind;
  enabled: boolean;
  keyframes: Keyframe[];
}

const ALL_CHANNELS: LineEventKind[] = ["x", "y", "rotation", "opacity", "speed"];

const CHANNEL_LABELS: Partial<Record<LineEventKind, string>> = {
  x: "X position",
  y: "Y position",
  rotation: "Rotation",
  opacity: "Opacity",
  speed: "Speed",
};

const CHANNEL_DEFAULTS: Partial<Record<LineEventKind, number>> = {
  x: 0,
  y: 0,
  rotation: 0,
  opacity: 255,
  speed: 1,
};

/** Channel identity colours: the shared event-kind tokens. */
const CHANNEL_COLORS: Partial<Record<LineEventKind, string>> = {
  x: "var(--event-x)",
  y: "var(--event-y)",
  rotation: "var(--event-rotation)",
  opacity: "var(--event-opacity)",
  speed: "var(--event-speed)",
};

const FIELD_LABEL_STYLE: React.CSSProperties = { color: "var(--text-secondary)" };

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "var(--space-4)",
};

const NUM_INPUT_STYLE: React.CSSProperties = { ...INPUT_STYLE, fontFamily: "var(--font-mono)", minWidth: 0 };

function generateKeyframeId(): string {
  return `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================
// Keyframe Strip: visual representation of keyframes on a channel
// ============================================================

function KeyframeStrip({
  channel,
  totalBeats,
  onAddKeyframe,
  onSelectKeyframe,
  selectedKeyframeId,
}: {
  channel: ChannelState;
  totalBeats: number;
  onAddKeyframe: (kind: LineEventKind, beatOffset: number) => void;
  onSelectKeyframe: (kind: LineEventKind, id: string | null) => void;
  selectedKeyframeId: string | null;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  const handleStripClick = (e: React.MouseEvent) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const beatOffset = (x / rect.width) * totalBeats;
    // Only add if not clicking on an existing keyframe
    if ((e.target as HTMLElement).dataset.keyframe) return;
    onAddKeyframe(channel.kind, Math.max(0, beatOffset));
  };

  return (
    <div className="mb-2">
      <div
        className="flex items-center gap-2 mb-1"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: CHANNEL_COLORS[channel.kind] }}
        />
        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {CHANNEL_LABELS[channel.kind]}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          ({channel.keyframes.length} keyframes)
        </span>
      </div>
      <div
        ref={stripRef}
        className="relative h-6 cursor-crosshair"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: "var(--hairline) solid var(--border-color)",
          borderRadius: "var(--radius-md)",
        }}
        onClick={handleStripClick}
      >
        {/* Beat grid lines */}
        {Array.from({ length: Math.ceil(totalBeats) }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i / totalBeats) * 100}%`,
              width: 1,
              backgroundColor: "var(--border-color)",
              opacity: 0.5,
            }}
          />
        ))}

        {/* Segments between keyframes */}
        {channel.keyframes
          .sort((a, b) => a.beatOffset - b.beatOffset)
          .map((kf, idx, arr) => {
            if (idx >= arr.length - 1) return null;
            const next = arr[idx + 1];
            const left = (kf.beatOffset / totalBeats) * 100;
            const width = ((next.beatOffset - kf.beatOffset) / totalBeats) * 100;
            return (
              <div
                key={`seg-${kf.id}`}
                className="absolute top-1/2 -translate-y-1/2"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  height: 2,
                  backgroundColor: CHANNEL_COLORS[channel.kind],
                  opacity: 0.5,
                }}
              />
            );
          })}

        {/* Keyframe dots */}
        {channel.keyframes.map((kf) => {
          const left = (kf.beatOffset / totalBeats) * 100;
          const isSelected = selectedKeyframeId === kf.id;
          const kfLabel = `Beat ${kf.beatOffset.toFixed(2)}, Value ${kf.useCurrent ? "$CURRENT" : kf.value}`;
          return (
            <Tooltip key={kf.id} content={kfLabel}>
              <div
                data-keyframe="true"
                role="img"
                aria-label={kfLabel}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full cursor-pointer"
                style={{
                  left: `${left}%`,
                  width: isSelected ? 10 : 8,
                  height: isSelected ? 10 : 8,
                  backgroundColor: CHANNEL_COLORS[channel.kind],
                  border: isSelected
                    ? "2px solid var(--text-primary)"
                    : "var(--rule) solid color-mix(in srgb, var(--text-primary) 50%, transparent)",
                  zIndex: isSelected ? "var(--z-raised)" : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectKeyframe(channel.kind, isSelected ? null : kf.id);
                }}
              />
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Keyframe Editor: shows details for a selected keyframe
// ============================================================

function KeyframeEditor({
  keyframe,
  kind,
  onUpdate,
  onDelete,
}: {
  keyframe: Keyframe;
  kind: LineEventKind;
  onUpdate: (changes: Partial<Keyframe>) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="p-2 space-y-2"
      style={{ backgroundColor: "var(--bg-active)", borderRadius: "var(--radius-lg)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: CHANNEL_COLORS[kind] }}>
          Keyframe details
        </span>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={onDelete}>
          Delete
        </Button>
      </div>

      {/* Beat offset */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
          Beat
        </span>
        <NumericInput
          className="flex-1 w-0 min-w-0"
          style={NUM_INPUT_STYLE}
          commitMode="blur"
          step="0.25"
          min={0}
          fallback={0}
          value={keyframe.beatOffset}
          onChange={(v) => onUpdate({ beatOffset: v })}
        />
      </label>

      {/* Value */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
          Value
        </span>
        {keyframe.useCurrent ? (
          <span className="flex-1 px-1 py-0.5 text-xs" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            $CURRENT
          </span>
        ) : (
          <NumericInput
            className="flex-1 w-0 min-w-0"
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            step="0.1"
            fallback={0}
            value={keyframe.value}
            onChange={(v) => onUpdate({ value: v })}
          />
        )}
        <Tooltip content="Use the line's current value">
          <label
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
          >
            <input
              type="checkbox"
              checked={keyframe.useCurrent}
              onChange={(e) => onUpdate({ useCurrent: e.target.checked })}
            />
            $CUR
          </label>
        </Tooltip>
      </label>

      {/* Easing */}
      <label className="flex items-center gap-2 text-xs">
        <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
          Easing
        </span>
        <select
          className="flex-1 w-0 min-w-0"
          style={{ ...SELECT_STYLE, minWidth: 0 }}
          value={typeof keyframe.easing === "string" ? keyframe.easing : "linear"}
          onChange={(e) => onUpdate({ easing: e.target.value as EasingType })}
        >
          {EASING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ============================================================
// Build EventPreset from channel states
// ============================================================

function buildPreset(
  name: string,
  description: string,
  channels: ChannelState[],
  totalBeats: number,
): EventPreset {
  const template: EventTemplate[] = [];
  const usedKinds = new Set<LineEventKind>();

  for (const channel of channels) {
    if (!channel.enabled || channel.keyframes.length < 2) continue;

    const sorted = [...channel.keyframes].sort((a, b) => a.beatOffset - b.beatOffset);

    for (let i = 0; i < sorted.length - 1; i++) {
      const kf = sorted[i];
      const next = sorted[i + 1];

      const startBeatOffset = floatToBeat(kf.beatOffset);
      const endBeatOffset = floatToBeat(next.beatOffset);
      const startValue: number | "$CURRENT" = kf.useCurrent ? "$CURRENT" : kf.value;
      const endValue: number | "$CURRENT" = next.useCurrent ? "$CURRENT" : next.value;

      template.push({
        kind: channel.kind,
        startBeatOffset,
        endBeatOffset,
        startValue,
        endValue,
        easing: kf.easing,
      });

      usedKinds.add(channel.kind);
    }
  }

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    description,
    template,
    channels: Array.from(usedKinds),
    defaultDuration: totalBeats,
    builtin: false,
    tags: ["custom"],
  };
}

// ============================================================
// Main PresetBuilder Component
// ============================================================

export function PresetBuilder({ onClose }: { onClose: () => void }) {
  const addCustomPreset = useSettingsStore((s) => s.addCustomPreset);

  const [name, setName] = useState("My Preset");
  const [description, setDescription] = useState("");
  const [totalBeats, setTotalBeats] = useState(4);
  const [channelStates, setChannelStates] = useState<ChannelState[]>(
    ALL_CHANNELS.map((kind) => ({
      kind,
      enabled: false,
      keyframes: [],
    })),
  );
  const [selectedChannel, setSelectedChannel] = useState<LineEventKind | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  const toggleChannel = (kind: LineEventKind) => {
    setChannelStates((prev) =>
      prev.map((ch) => {
        if (ch.kind !== kind) return ch;
        const enabled = !ch.enabled;
        return {
          ...ch,
          enabled,
          // Initialize with two default keyframes when enabling
          keyframes: enabled && ch.keyframes.length === 0
            ? [
                {
                  id: generateKeyframeId(),
                  beatOffset: 0,
                  value: CHANNEL_DEFAULTS[kind] ?? 0,
                  useCurrent: false,
                  easing: "linear",
                },
                {
                  id: generateKeyframeId(),
                  beatOffset: totalBeats,
                  value: CHANNEL_DEFAULTS[kind] ?? 0,
                  useCurrent: false,
                  easing: "linear",
                },
              ]
            : ch.keyframes,
        };
      }),
    );
  };

  const addKeyframe = useCallback(
    (kind: LineEventKind, beatOffset: number) => {
      setChannelStates((prev) =>
        prev.map((ch) => {
          if (ch.kind !== kind) return ch;
          const newKf: Keyframe = {
            id: generateKeyframeId(),
            beatOffset: Math.round(beatOffset * 4) / 4, // snap to quarter beats
            value: CHANNEL_DEFAULTS[kind] ?? 0,
            useCurrent: false,
            easing: "linear",
          };
          return { ...ch, keyframes: [...ch.keyframes, newKf] };
        }),
      );
    },
    [],
  );

  const selectKeyframe = useCallback(
    (kind: LineEventKind, id: string | null) => {
      setSelectedChannel(id ? kind : null);
      setSelectedKeyframeId(id);
    },
    [],
  );

  const updateKeyframe = useCallback(
    (kind: LineEventKind, id: string, changes: Partial<Keyframe>) => {
      setChannelStates((prev) =>
        prev.map((ch) => {
          if (ch.kind !== kind) return ch;
          return {
            ...ch,
            keyframes: ch.keyframes.map((kf) =>
              kf.id === id ? { ...kf, ...changes } : kf,
            ),
          };
        }),
      );
    },
    [],
  );

  const deleteKeyframe = useCallback(
    (kind: LineEventKind, id: string) => {
      setChannelStates((prev) =>
        prev.map((ch) => {
          if (ch.kind !== kind) return ch;
          return {
            ...ch,
            keyframes: ch.keyframes.filter((kf) => kf.id !== id),
          };
        }),
      );
      setSelectedKeyframeId(null);
      setSelectedChannel(null);
    },
    [],
  );

  const handleSave = () => {
    const preset = buildPreset(name.trim(), description.trim(), channelStates, totalBeats);
    if (preset.template.length === 0) {
      useToastStore.getState().addToast({ message: "Give a channel at least two keyframes to save the preset", type: "info" });
      return;
    }
    addCustomPreset(preset);
    onClose();
  };

  const selectedKf =
    selectedChannel && selectedKeyframeId
      ? channelStates
          .find((ch) => ch.kind === selectedChannel)
          ?.keyframes.find((kf) => kf.id === selectedKeyframeId)
      : null;

  const enabledChannelCount = channelStates.filter((ch) => ch.enabled).length;

  return (
    <Dialog
      title="Preset builder"
      icon={SlidersHorizontal}
      onClose={onClose}
      width={520}
      bodyStyle={{ maxHeight: "75vh" }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={enabledChannelCount === 0 || !name.trim()}
          >
            Save preset
          </Button>
        </>
      }
    >
      {/* Name and description */}
      <div className="space-y-2 mb-3">
        <label className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
            Name
          </span>
          <input
            className="flex-1 w-0 min-w-0"
            style={{ ...INPUT_STYLE, minWidth: 0 }}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
            Description
          </span>
          <input
            className="flex-1 w-0 min-w-0"
            style={{ ...INPUT_STYLE, minWidth: 0 }}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description…"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="w-16 text-right flex-shrink-0" style={FIELD_LABEL_STYLE}>
            Duration
          </span>
          <NumericInput
            className="flex-1 w-0 min-w-0"
            style={NUM_INPUT_STYLE}
            commitMode="blur"
            integer
            step="1"
            min={1}
            max={32}
            fallback={4}
            value={totalBeats}
            onChange={setTotalBeats}
          />
          <span className="text-xs" style={FIELD_LABEL_STYLE}>beats</span>
        </label>
      </div>

      {/* Channel selector */}
      <div className="mb-3">
        <div style={SECTION_LABEL_STYLE}>
          Channels
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_CHANNELS.map((kind) => {
            const ch = channelStates.find((c) => c.kind === kind);
            const isEnabled = ch?.enabled ?? false;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isEnabled}
                className="ui-pill"
                style={{
                  backgroundColor: isEnabled
                    ? `color-mix(in srgb, ${CHANNEL_COLORS[kind]} 20%, transparent)`
                    : "var(--bg-active)",
                  color: isEnabled ? CHANNEL_COLORS[kind] : "var(--text-secondary)",
                  fontSize: "var(--fs-control)",
                }}
                onClick={() => toggleChannel(kind)}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 6, height: 6, borderRadius: "var(--radius-full)", backgroundColor: CHANNEL_COLORS[kind], flexShrink: 0 }}
                />
                {CHANNEL_LABELS[kind]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Keyframe strips for enabled channels */}
      {enabledChannelCount > 0 && (
        <div className="mb-3">
          <div style={SECTION_LABEL_STYLE}>
            Keyframes (click strip to add)
          </div>
          {channelStates
            .filter((ch) => ch.enabled)
            .map((ch) => (
              <KeyframeStrip
                key={ch.kind}
                channel={ch}
                totalBeats={totalBeats}
                onAddKeyframe={addKeyframe}
                onSelectKeyframe={selectKeyframe}
                selectedKeyframeId={
                  selectedChannel === ch.kind ? selectedKeyframeId : null
                }
              />
            ))}
        </div>
      )}

      {/* Selected keyframe editor */}
      {selectedKf && selectedChannel && (
        <div className="mb-3">
          <KeyframeEditor
            keyframe={selectedKf}
            kind={selectedChannel}
            onUpdate={(changes) =>
              updateKeyframe(selectedChannel, selectedKf.id, changes)
            }
            onDelete={() => deleteKeyframe(selectedChannel, selectedKf.id)}
          />
        </div>
      )}

      {/* Summary */}
      {enabledChannelCount > 0 && (
        <div
          className="text-xs p-2"
          style={{ backgroundColor: "var(--bg-active)", borderRadius: "var(--radius-lg)", color: "var(--text-secondary)" }}
        >
          Preset will generate{" "}
          {channelStates.reduce(
            (sum, ch) => sum + (ch.enabled ? Math.max(0, ch.keyframes.length - 1) : 0),
            0,
          )}{" "}
          event(s) across {enabledChannelCount} channel(s) over {totalBeats} beat(s).
        </div>
      )}
    </Dialog>
  );
}
