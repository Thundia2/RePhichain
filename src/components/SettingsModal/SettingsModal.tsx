// ============================================================
// Settings Modal — Tabbed settings for editor configuration
//
// Provides categorized settings (General, Audio, Game preview,
// Timeline, Editor, AI generation, Resource pack, Notifications)
// rendered in the shared <Dialog> with a sidebar list. Each
// category renders Card/CardRow rows with toggles, sliders,
// segmented controls and inputs that read/write to settingsStore.
// The Audio tab hosts LatencyCalibration for per-device audio
// latency compensation. Also manages resource pack import/deletion
// via respackStore.
// ============================================================

import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useRespackStore } from "../../stores/respackStore";
import { useToastStore } from "../../stores/toastStore";
import { Card, CardRow, SectionHeader, ActionButton, Toggle, INPUT_STYLE, SELECT_STYLE } from "../common/UIKit";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { SegmentedControl as SharedSegmentedControl } from "../common/SegmentedControl";
import { LatencyCalibration } from "./LatencyCalibration";
import { AI_SYSTEM_PROMPT } from "../../utils/aiSystemPrompt";

type Category = "general" | "audio" | "game-preview" | "timeline" | "editor" | "ai" | "resource-pack" | "notifications";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "general", label: "General" },
  { id: "audio", label: "Audio" },
  { id: "game-preview", label: "Game preview" },
  { id: "timeline", label: "Timeline" },
  { id: "editor", label: "Editor" },
  { id: "ai", label: "AI generation" },
  { id: "resource-pack", label: "Resource pack" },
  { id: "notifications", label: "Notifications" },
];

/* ── Reusable sub-components ── */

const VALUE_TEXT_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  fontFamily: "var(--font-mono)",
  color: "var(--text-secondary)",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

function Select({
  value,
  onChange,
  children,
  "aria-label": ariaLabel,
}: {
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      style={SELECT_STYLE}
    >
      {children}
    </select>
  );
}
// Named by its CardRow label.
Select.labelable = true;

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  label?: string;
}) {
  return (
    <div className="flex items-center" style={{ gap: "var(--space-8)" }}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 96 }}
      />
      <span style={{ ...VALUE_TEXT_STYLE, width: 40 }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

/** Accent segmented control for a setting value (string options). */
function SegmentedControl({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <SharedSegmentedControl
      tone="accent"
      size="sm"
      value={value}
      options={options}
      onChange={onChange}
      label={label}
    />
  );
}

/* ── Category content renderers ── */

function GeneralContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  return (
    <div>
      <SectionHeader>Interface</SectionHeader>
      <Card>
        <CardRow label="Language">
          <Select value={settings.language} onChange={(v) => update({ language: v })}>
            <option value="en">English</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
          </Select>
        </CardRow>
        <CardRow label="Default editor view" last>
          <SegmentedControl
            value={settings.defaultEditorView}
            options={[
              { value: "unified", label: "Unified" },
              { value: "classic", label: "Classic" },
            ]}
            onChange={(v) => update({ defaultEditorView: v as "unified" | "classic" })}
            label="Default editor view"
          />
        </CardRow>
      </Card>
    </div>
  );
}

function AudioContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeader>Playback</SectionHeader>
        <Card>
          <CardRow label="Music volume">
            <Slider
              label="Music volume"
              value={settings.musicVolume}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ musicVolume: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </CardRow>
          <CardRow label="Hit sound volume">
            <Slider
              label="Hit sound volume"
              value={settings.hitSoundVolume}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ hitSoundVolume: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </CardRow>
          <CardRow label="Enable hit sounds" description="Play sounds when notes are hit" last>
            <Toggle
              label="Enable hit sounds"
              checked={settings.hitSoundEnabled}
              onChange={(v) => update({ hitSoundEnabled: v })}
            />
          </CardRow>
        </Card>
      </div>

      {/* Latency Calibration: manual slider + tap-to-calibrate flow */}
      <div>
        <SectionHeader>Latency calibration</SectionHeader>
        <Card>
          <LatencyCalibration />
        </Card>
      </div>
    </div>
  );
}

function GamePreviewContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  return (
    <div>
      <SectionHeader>Visuals</SectionHeader>
      <Card>
        <CardRow label="GPU renderer (experimental, on hold)" description="Use PixiJS WebGL for faster rendering on big charts. Requires restart. Still undergoing testing.">
          <Toggle
              label="GPU renderer (experimental, on hold)"
            checked={settings.usePixiRenderer}
            onChange={(v) => update({ usePixiRenderer: v })}
          />
        </CardRow>
        <CardRow label="Hit animations" description="Particle effects when notes are hit">
          <Toggle
              label="Hit animations"
            checked={settings.showHitEffects}
            onChange={(v) => update({ showHitEffects: v })}
          />
        </CardRow>
        <CardRow label="Note size">
          <Slider
              label="Note size"
            value={settings.noteSize}
            min={0.5} max={2} step={0.1}
            onChange={(v) => update({ noteSize: v })}
            format={(v) => `${v.toFixed(1)}x`}
          />
        </CardRow>
        <CardRow label="Background dim">
          <Slider
              label="Background dim"
            value={settings.backgroundDim}
            min={0} max={1} step={0.05}
            onChange={(v) => update({ backgroundDim: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </CardRow>
        <CardRow label="FC/AP indicator" description="Full combo and all perfect indicators">
          <Toggle
              label="FC/AP indicator"
            checked={settings.showFcApIndicator}
            onChange={(v) => update({ showFcApIndicator: v })}
          />
        </CardRow>
        <CardRow label="Multi highlight" description="Highlight notes on the same beat">
          <Toggle
              label="Multi highlight"
            checked={settings.multiHighlight}
            onChange={(v) => update({ multiHighlight: v })}
          />
        </CardRow>
        <CardRow label="Show HUD" description="Combo, score, and chart info during playback">
          <Toggle
              label="Show HUD"
            checked={settings.showHud}
            onChange={(v) => update({ showHud: v })}
          />
        </CardRow>
        <CardRow label="Anchor markers" description="Circles at judgment line origins" last>
          <Select
            value={settings.anchorMarkerVisibility}
            onChange={(v) => update({ anchorMarkerVisibility: v as "never" | "always" | "when_visible" })}
          >
            <option value="never">Never</option>
            <option value="always">Always</option>
            <option value="when_visible">When visible</option>
          </Select>
        </CardRow>
      </Card>
    </div>
  );
}

function TimelineContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  return (
    <div>
      <SectionHeader>Behavior</SectionHeader>
      <Card>
        <CardRow label="Invert scroll direction" description="Reverse timeline scroll">
          <Toggle
              label="Invert scroll direction"
            checked={settings.invertScrollDirection}
            onChange={(v) => update({ invertScrollDirection: v })}
          />
        </CardRow>
        <CardRow label="Follow playback" description="Auto-scroll to keep current time in view" last>
          <Toggle
              label="Follow playback"
            checked={settings.timelineFollowPlayback}
            onChange={(v) => update({ timelineFollowPlayback: v })}
          />
        </CardRow>
      </Card>
    </div>
  );
}

function EditorContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  const latencyOffset = useBookmarkStore((s) => s.latencyOffset);
  const setLatencyOffset = useBookmarkStore((s) => s.setLatencyOffset);
  const visibilityRange = useBookmarkStore((s) => s.visibilityRange);
  const setVisibilityRange = useBookmarkStore((s) => s.setVisibilityRange);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeader>Mark mode</SectionHeader>
        <Card>
          <CardRow label="Latency offset" description="Shifts markers back to compensate for reaction time">
            <div className="flex items-center" style={{ gap: "var(--space-6)" }}>
              <input
                type="range"
                min={-100}
                max={0}
                step={5}
                value={latencyOffset}
                onChange={(e) => setLatencyOffset(parseInt(e.target.value))}
                aria-label="Latency offset"
                style={{ width: 96 }}
              />
              <span style={{ ...VALUE_TEXT_STYLE, minWidth: 40 }}>
                {latencyOffset}ms
              </span>
            </div>
          </CardRow>
          <CardRow label="Visibility range" description="How far from playhead bookmarks stay visible" last>
            <div className="flex items-center" style={{ gap: "var(--space-6)" }}>
              <input
                type="range"
                min={0.5}
                max={8.0}
                step={0.5}
                value={visibilityRange}
                onChange={(e) => setVisibilityRange(parseFloat(e.target.value))}
                aria-label="Visibility range"
                style={{ width: 96 }}
              />
              <span style={{ ...VALUE_TEXT_STYLE, minWidth: 40 }}>
                {visibilityRange.toFixed(1)}b
              </span>
            </div>
          </CardRow>
        </Card>
      </div>
      <div>
        <SectionHeader>Event editor</SectionHeader>
        <Card>
          <CardRow label="Rotation snap angle" description="Snap to fixed intervals (0 = off)" last>
            <Select
              value={settings.rotationSnapDegrees}
              onChange={(v) => update({ rotationSnapDegrees: parseInt(v) })}
            >
              <option value={0}>Off</option>
              <option value={5}>5°</option>
              <option value={10}>10°</option>
              <option value={15}>15°</option>
              <option value={30}>30°</option>
              <option value={45}>45°</option>
              <option value={90}>90°</option>
            </Select>
          </CardRow>
        </Card>
      </div>
      <div>
        <SectionHeader>Unrolled editor</SectionHeader>
        <Card>
          <CardRow
            label="Event span tints"
            description="Faint colored wash between an event's start and end beats. Disable on busy charts where overlapping tints look muddy."
            last
          >
            <Toggle
              label="Event span tints"
              checked={settings.unrolledShowEventSpanTints}
              onChange={(v) => update({ unrolledShowEventSpanTints: v })}
            />
          </CardRow>
        </Card>
      </div>
      <div>
        <SectionHeader>Tab bar</SectionHeader>
        <Card>
          <CardRow label="Tab height" description="Height of editor tab buttons in pixels">
            <Slider
              label="Tab height"
              value={settings.tabHeight}
              min={24}
              max={48}
              step={2}
              onChange={(v) => update({ tabHeight: v })}
              format={(v) => `${v}px`}
            />
          </CardRow>
          <CardRow label="Tab max width" description="Maximum width of each tab button" last>
            <Slider
              label="Tab max width"
              value={settings.tabMaxWidth}
              min={120}
              max={400}
              step={10}
              onChange={(v) => update({ tabMaxWidth: v })}
              format={(v) => `${v}px`}
            />
          </CardRow>
        </Card>
      </div>
      <div>
        <SectionHeader>Line strip</SectionHeader>
        <Card>
          <CardRow label="Note inactivity timeout" description="Demote lines to inactive when no note arrives within this window (0 = disabled)" last>
            <Slider
              label="Note inactivity timeout"
              value={settings.lineInactivityTimeoutSeconds}
              min={0}
              max={30}
              step={1}
              onChange={(v) => update({ lineInactivityTimeoutSeconds: v })}
              format={(v) => v === 0 ? "Off" : `${v}s`}
            />
          </CardRow>
        </Card>
      </div>
      <div>
        <SectionHeader>Autosave</SectionHeader>
        <Card>
          <CardRow label="Enable autosave">
            <Toggle
              label="Enable autosave"
              checked={settings.autosaveEnabled}
              onChange={(v) => update({ autosaveEnabled: v })}
            />
          </CardRow>
          <CardRow label="Save interval" last>
            <div className="flex items-center" style={{ gap: "var(--space-6)" }}>
              <input
                type="number"
                value={settings.autosaveIntervalSeconds}
                min={10}
                max={3600}
                onChange={(e) =>
                  update({ autosaveIntervalSeconds: Math.max(10, parseInt(e.target.value) || 120) })
                }
                aria-label="Save interval in seconds"
                style={{ ...INPUT_STYLE, width: 64, textAlign: "right", fontFamily: "var(--font-mono)" }}
              />
              <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-caption)" }}>sec</span>
            </div>
          </CardRow>
        </Card>
      </div>
    </div>
  );
}

function AiContent() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState("");

  const isRemote = settings.aiMode === "remote";

  // D8: switch ONLY the mode. The old code applied presets that overwrote the
  // user's endpoint/model and CLEARED aiApiKey ("") on every toggle — flipping to
  // local and back to remote silently wiped a configured API key. The endpoint /
  // model / key each have their own inputs below; leave them to the user.
  const handleModeChange = (mode: string) => {
    update({ aiMode: mode as "local" | "remote" });
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      const { generateAi } = await import("../../utils/ipc");
      await generateAi({
        endpoint: settings.aiEndpoint,
        model: settings.aiModel,
        messages: [{ role: "user", content: "Say OK" }],
        temperature: 0.0,
        maxTokens: 10,
        apiKey: settings.aiApiKey || undefined,
      });
      setTestStatus("success");
    } catch (err) {
      setTestStatus("error");
      setTestError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeader>AI generation</SectionHeader>
        <Card>
          <CardRow label="Enable AI generation" description="Adds an AI tab to the context panel for natural language chart generation">
            <Toggle
              label="Enable AI generation"
              checked={settings.aiEnabled}
              onChange={(v) => update({ aiEnabled: v })}
            />
          </CardRow>
          <CardRow label="Server mode" description="Local runs your own model. Remote uses a cloud API with an API key.">
            <SegmentedControl
              value={settings.aiMode}
              options={[
                { value: "remote", label: "Remote API" },
                { value: "local", label: "Local server" },
              ]}
              onChange={handleModeChange}
              label="Server mode"
            />
          </CardRow>
        </Card>
      </div>

      <div>
        <SectionHeader>{isRemote ? "Remote API" : "Local server"}</SectionHeader>
        <Card>
          <CardRow label="Endpoint URL" description={isRemote ? "OpenAI-compatible API base URL" : "Local server URL (Ollama, vLLM, llama.cpp)"}>
            <input
              type="text"
              value={settings.aiEndpoint}
              onChange={(e) => update({ aiEndpoint: e.target.value })}
              placeholder={isRemote ? "https://generativelanguage.googleapis.com/v1beta/openai" : "http://localhost:11434"}
              aria-label="Endpoint URL"
              style={{ ...INPUT_STYLE, width: 200, fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)" }}
            />
          </CardRow>
          <CardRow label="Model" description={isRemote ? "API model ID (e.g. gemma-3-27b-it)" : "Ollama model name (e.g. gemma4:27b)"}>
            <input
              type="text"
              value={settings.aiModel}
              onChange={(e) => update({ aiModel: e.target.value })}
              placeholder={isRemote ? "gemma-3-27b-it" : "gemma4:27b"}
              aria-label="Model"
              style={{ ...INPUT_STYLE, width: 140, fontFamily: "var(--font-mono)" }}
            />
          </CardRow>
          {isRemote && (
            <CardRow label="API key" description="Bearer token for the remote API">
              <input
                type="password"
                value={settings.aiApiKey}
                onChange={(e) => update({ aiApiKey: e.target.value })}
                placeholder="Paste your API key"
                aria-label="API key"
                style={{
                  ...INPUT_STYLE,
                  width: 180,
                  fontFamily: "var(--font-mono)",
                  borderColor: settings.aiApiKey ? "var(--border-color)" : "color-mix(in srgb, var(--error) 40%, transparent)",
                }}
              />
            </CardRow>
          )}
          <CardRow label="Temperature" description="Lower = more deterministic, higher = more creative">
            <Slider
              label="Temperature"
              value={settings.aiTemperature}
              min={0} max={1} step={0.05}
              onChange={(v) => update({ aiTemperature: v })}
              format={(v) => v.toFixed(2)}
            />
          </CardRow>
          <CardRow label="Max tokens" description="Maximum response length" last>
            <input
              type="number"
              value={settings.aiMaxTokens}
              min={512}
              max={16384}
              step={256}
              onChange={(e) => update({ aiMaxTokens: Math.max(512, parseInt(e.target.value) || 4096) })}
              aria-label="Max tokens"
              style={{ ...INPUT_STYLE, width: 72, textAlign: "right", fontFamily: "var(--font-mono)" }}
            />
          </CardRow>
        </Card>
      </div>

      <div>
        <SectionHeader>Connection test</SectionHeader>
        <Card>
          <div style={{ padding: "var(--space-10) var(--space-12)" }}>
            <div className="flex items-center" style={{ gap: "var(--space-12)" }}>
              <Button
                variant="primary"
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
                style={{ cursor: testStatus === "testing" ? "wait" : undefined }}
              >
                {testStatus === "testing" ? "Testing…" : "Test connection"}
              </Button>
              {testStatus === "success" && (
                <span style={{ fontSize: "var(--fs-control)", color: "var(--success)" }}>Connected successfully</span>
              )}
              {testStatus === "error" && (
                <span style={{ fontSize: "var(--fs-control)", color: "var(--error)" }}>Connection failed</span>
              )}
            </div>
            {testStatus === "error" && testError && (
              <div style={{
                marginTop: "var(--space-8)",
                padding: "var(--space-6) var(--space-10)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-caption)",
                color: "var(--error)",
                backgroundColor: "color-mix(in srgb, var(--error) 8%, transparent)",
                fontFamily: "var(--font-mono)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {testError}
              </div>
            )}
            {isRemote && !settings.aiApiKey && (
              <div style={{ marginTop: "var(--space-8)", fontSize: "var(--fs-caption)", color: "var(--warning)", lineHeight: 1.5 }}>
                No API key set. Remote APIs require an API key to authenticate.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ---- System Prompt ---- */}
      <AiPromptEditor />
    </div>
  );
}

/** Collapsible built-in prompt viewer + editable custom instructions textarea */
function AiPromptEditor() {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  const [builtInExpanded, setBuiltInExpanded] = useState(false);

  return (
    <div>
      <SectionHeader>System prompt</SectionHeader>
      <Card>
        {/* Built-in prompt viewer (read-only, collapsible) */}
        <div style={{ borderBottom: "var(--rule) solid var(--separator)" }}>
          <button
            type="button"
            className="ui-hover"
            aria-expanded={builtInExpanded}
            onClick={() => setBuiltInExpanded(!builtInExpanded)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-10) var(--space-12)",
              border: "none",
              cursor: "pointer",
              color: "var(--text-primary)",
              fontSize: "var(--fs-control)",
              fontFamily: "inherit",
            }}
          >
            <span>Built-in prompt</span>
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
              {builtInExpanded ? "Hide" : "View"} ({AI_SYSTEM_PROMPT.length} chars)
            </span>
          </button>
          {builtInExpanded && (
            <pre style={{
              padding: "var(--space-8) var(--space-12) var(--space-12)",
              margin: 0,
              fontSize: "var(--fs-caption)",
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 250,
              overflowY: "auto",
              borderTop: "var(--rule) solid var(--separator)",
              backgroundColor: "var(--bg-tertiary)",
            }}>
              {AI_SYSTEM_PROMPT}
            </pre>
          )}
        </div>

        {/* Custom instructions textarea */}
        <div style={{ padding: "var(--space-10) var(--space-12)" }}>
          <div style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
            Additional instructions
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginBottom: "var(--space-8)", lineHeight: 1.5 }}>
            Appended after the built-in prompt. Use this to customize AI behavior without modifying source code.
          </div>
          <textarea
            value={settings.aiCustomPrompt}
            onChange={(e) => update({ aiCustomPrompt: e.target.value })}
            placeholder="e.g., Always use ease_out_cubic for opacity transitions. Prefer drag notes over tap notes for fast sections."
            rows={4}
            aria-label="Additional instructions"
            style={{
              ...INPUT_STYLE,
              width: "100%",
              height: "auto",
              padding: "var(--space-8) var(--space-10)",
              fontFamily: "var(--font-mono)",
              lineHeight: 1.5,
              resize: "vertical",
              minHeight: 60,
              maxHeight: 200,
            }}
          />
          {settings.aiCustomPrompt && (
            <div style={{ marginTop: "var(--space-6)", display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
              <ActionButton variant="danger" onClick={() => update({ aiCustomPrompt: "" })}>
                Reset to default
              </ActionButton>
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {settings.aiCustomPrompt.length} chars
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function ResourcePackContent() {
  const respacks = useRespackStore((s) => s.respacks);
  const selectedId = useRespackStore((s) => s.selectedId);
  const selectRespack = useRespackStore((s) => s.selectRespack);
  const importRespack = useRespackStore((s) => s.importRespack);
  const deleteRespack = useRespackStore((s) => s.deleteRespack);

  const activeRespack = selectedId ? respacks.get(selectedId) ?? null : null;
  const respackList = Array.from(respacks.values());

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        await importRespack(arrayBuffer);
      } catch (err) {
        console.error("Respack import failed:", err);
        const { useToastStore } = await import("../../stores/toastStore");
        useToastStore.getState().addToast({ message: "Failed to import respack. Check the console for details.", type: "error" });
      }
    };
    input.click();
  };

  const handleDelete = async (id: string, name: string) => {
    const { showConfirm } = await import("../common/ConfirmDialog");
    if (await showConfirm("This removes it from this computer.", {
      title: `Delete respack "${name}"?`,
      confirmLabel: "Delete",
      danger: true,
    })) {
      deleteRespack(id);
    }
  };

  return (
    <div>
      <SectionHeader>Resource pack</SectionHeader>
      <Card>
        <CardRow label="Active respack" description="Note textures and hit effects" last>
          <Select
            value={selectedId ?? ""}
            onChange={(v) => selectRespack(v || null)}
          >
            <option value="">Default (colored)</option>
            {respackList.map((rp) => (
              <option key={rp.id} value={rp.id}>{rp.config.name}</option>
            ))}
          </Select>
        </CardRow>
      </Card>

      {activeRespack && (
        <div style={{ padding: "var(--space-8) var(--space-2)", fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          {activeRespack.config.author && <div>by {activeRespack.config.author}</div>}
          {activeRespack.config.description && <div>{activeRespack.config.description}</div>}
        </div>
      )}

      <div className="flex items-center" style={{ gap: "var(--space-8)", marginTop: "var(--space-12)" }}>
        <ActionButton variant="primary" onClick={handleImport}>
          Import respack…
        </ActionButton>

        {activeRespack && (
          <ActionButton variant="danger" onClick={() => handleDelete(activeRespack.id, activeRespack.config.name)}>
            Delete
          </ActionButton>
        )}
      </div>
    </div>
  );
}

const TOAST_TYPE_COLORS: Record<"error" | "info" | "success" | "warning", string> = {
  error: "var(--error)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function NotificationsContent() {
  const history = useToastStore((s) => s.history);
  const clearHistory = useToastStore((s) => s.clearHistory);
  const reversed = [...history].reverse();

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
        <SectionHeader>Notification history</SectionHeader>
        {history.length > 0 && (
          <ActionButton variant="danger" onClick={clearHistory}>
            Clear history
          </ActionButton>
        )}
      </div>

      {reversed.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "var(--space-32) 0",
          color: "var(--text-secondary)",
          fontSize: "var(--fs-body)",
        }}>
          No notifications yet
        </div>
      ) : (
        <Card>
          {reversed.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-10)",
                padding: "var(--space-10) var(--space-12)",
                borderBottom: i === reversed.length - 1 ? "none" : "var(--rule) solid var(--separator)",
              }}
            >
              <div
                aria-label={entry.type}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--radius-full)",
                  backgroundColor: TOAST_TYPE_COLORS[entry.type],
                  flexShrink: 0,
                  marginTop: "var(--space-4)",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", lineHeight: "1.45" }}>
                  {entry.message}
                </div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-2)", fontFamily: "var(--font-mono)" }}>
                  {formatTimestamp(entry.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ── Main Modal Component ── */

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>("general");

  if (!open) return null;

  const renderContent = () => {
    switch (activeCategory) {
      case "general":
        return <GeneralContent />;
      case "audio":
        return <AudioContent />;
      case "game-preview":
        return <GamePreviewContent />;
      case "timeline":
        return <TimelineContent />;
      case "editor":
        return <EditorContent />;
      case "ai":
        return <AiContent />;
      case "resource-pack":
        return <ResourcePackContent />;
      case "notifications":
        return <NotificationsContent />;
    }
  };

  return (
    <Dialog
      title="Settings"
      icon={SettingsIcon}
      onClose={onClose}
      width={600}
      height="min(80vh, 640px)"
      bodyStyle={{ display: "flex", padding: 0, overflow: "hidden", borderTop: "var(--rule) solid var(--separator)" }}
    >
      {/* Sidebar */}
      <nav
        aria-label="Settings categories"
        className="flex flex-col flex-shrink-0"
        style={{
          width: 148,
          padding: "var(--space-8)",
          borderRight: "var(--rule) solid var(--separator)",
          gap: "var(--space-2)",
          overflowY: "auto",
          color: "var(--text-secondary)",
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={isActive ? "flex items-center" : "flex items-center ui-hover"}
              style={{
                minHeight: "var(--control-lg)",
                padding: "0 var(--space-10)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-body)",
                cursor: "pointer",
                border: "none",
                textAlign: "left",
                // Inactive rows take their colour from the nav and their hover
                // wash from .ui-hover (no inline colours to override it).
                ...(isActive ? { backgroundColor: "var(--accent-selected)", color: "var(--accent-primary)" } : {}),
              }}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ minWidth: 0, padding: "var(--space-4) var(--space-20) var(--space-20)" }}
      >
        {renderContent()}
      </div>
    </Dialog>
  );
}
