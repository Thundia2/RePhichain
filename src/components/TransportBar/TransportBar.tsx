// ============================================================
// Transport Bar — Independent playback & time scrub control
//
// Sits between the canvas and keyframe bar. Contains:
//   - Play/Pause + Stop buttons
//   - Speed presets (0.25×, 0.5×, 0.75×, 1×) as a segmented control
//   - Loop toggle + in/out markers
//   - Time display (formatted time + beat)
//   - Custom styled time scrub slider
//
// Extracted from KeyframeBar (transport) and UnifiedInspector
// (TimeScrub) into a single independent component.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAudioStore } from "../../stores/audioStore";
import { audioEngine } from "../../audio/audioEngine";
import { getPlayheadBeat } from "../../utils/playhead";
import { ArrowLeftToLine, ArrowRightToLine, Pause, Play, Repeat, Square, X } from "lucide-react";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import { SegmentedControl } from "../common/SegmentedControl";
import { Tooltip } from "../common/Tooltip";

// ============================================================
// Constants
// ============================================================

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0];

// ============================================================
// Component
// ============================================================

export function TransportBar() {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);
  const duration = useAudioStore((s) => s.duration);
  const loopEnabled = useAudioStore((s) => s.loopEnabled);
  const loopStartBeat = useAudioStore((s) => s.loopStartBeat);
  const loopEndBeat = useAudioStore((s) => s.loopEndBeat);

  const [displayTime, setDisplayTime] = useState(0);
  const [displayBeat, setDisplayBeat] = useState(0);

  const stopPlayback = useCallback(() => audioEngine.stop(), []);

  // Smooth time/beat tracking via rAF
  useEffect(() => {
    let raf = 0;
    function tick() {
      const { currentTime } = useAudioStore.getState();
      setDisplayTime(currentTime);
      try {
        // rAF tick reads the live clock imperatively → raw playhead beat.
        setDisplayBeat(getPlayheadBeat());
      } catch {
        setDisplayBeat(0);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useAudioStore.getState().seek(parseFloat(e.target.value));
  }, []);

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const maxTime = Math.max(duration, 1);
  // W5: clamp to [0,100]. displayTime can briefly exceed duration (Howler reports a
  // currentTime slightly past the end, or duration is stale mid-load), which otherwise
  // pushes the filled bar + thumb past the track and into the time label.
  const progress = Math.max(0, Math.min(100, (displayTime / maxTime) * 100));

  return (
    <div
      role="toolbar"
      aria-label="Transport"
      style={{
        height: "var(--panel-header-height)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        padding: "0 var(--space-12)",
        background: "var(--bg-secondary)",
        borderTop: "var(--rule) solid var(--border-color)",
        borderBottom: "var(--rule) solid var(--border-color)",
        flexShrink: 0,
        fontFamily: "inherit",
        fontSize: "var(--fs-control)",
      }}
    >
      {/* ── Play / Pause / Stop ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <IconButton
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause" : "Play"}
          shortcut={{ action: "toggle_playback" }}
          size="lg"
          iconSize={14}
          active={isPlaying}
          onClick={togglePlayPause}
        />
        <IconButton icon={Square} label="Stop" size="lg" iconSize={14} onClick={stopPlayback} />
      </div>

      <TransportDivider />

      {/* ── Speed presets ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <span style={{ color: "var(--text-secondary)" }}>Speed</span>
        <SegmentedControl
          label="Playback speed"
          tone="accent"
          size="sm"
          value={playbackRate}
          onChange={setPlaybackRate}
          options={SPEED_PRESETS.map((v) => ({ value: v, label: `${v}×` }))}
        />
      </div>

      <TransportDivider />

      {/* ── Loop controls ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <IconButton
          icon={Repeat}
          label="Loop"
          shortcut={{ action: "toggle_loop" }}
          size="md"
          active={loopEnabled}
          onClick={() => useAudioStore.getState().toggleLoop()}
        />
        <Tooltip content={loopStartBeat !== null ? `Loop start at beat ${loopStartBeat.toFixed(2)}` : "Set loop start at the playhead"} shortcut={{ action: "loop_start" }}>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            style={loopStartBeat !== null ? { fontFamily: "var(--font-mono)", color: "var(--accent-primary)" } : undefined}
            onClick={() => useAudioStore.getState().setLoopStart(getPlayheadBeat())}
          >
            <Icon icon={ArrowRightToLine} size={12} />
            {loopStartBeat !== null ? loopStartBeat.toFixed(1) : "In"}
          </button>
        </Tooltip>
        <Tooltip content={loopEndBeat !== null ? `Loop end at beat ${loopEndBeat.toFixed(2)}` : "Set loop end at the playhead"} shortcut={{ action: "loop_end" }}>
          <button
            type="button"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            style={loopEndBeat !== null ? { fontFamily: "var(--font-mono)", color: "var(--accent-primary)" } : undefined}
            onClick={() => useAudioStore.getState().setLoopEnd(getPlayheadBeat())}
          >
            {loopEndBeat !== null ? loopEndBeat.toFixed(1) : "Out"}
            <Icon icon={ArrowLeftToLine} size={12} />
          </button>
        </Tooltip>

        {/* Clear loop — only show when start or end is set */}
        {(loopStartBeat !== null || loopEndBeat !== null) && (
          <IconButton icon={X} label="Clear loop markers" size="sm" onClick={() => useAudioStore.getState().clearLoop()} />
        )}
      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Time display ── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-6)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", fontWeight: 600 }}>
          {formatTime(displayTime)}
        </span>
        <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
          b{displayBeat.toFixed(2)}
        </span>
      </div>

      {/* ── Time scrub slider ── */}
      <div style={{ width: 260, display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
        <div className="ui-scrub" style={{ position: "relative", flex: 1, height: 16, display: "flex", alignItems: "center" }}>
          {/* Track background */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 4,
              borderRadius: "var(--radius-full)",
              background: "var(--bg-active)",
            }}
          />
          {/* Filled portion */}
          <div
            style={{
              position: "absolute",
              left: 0,
              width: `${progress}%`,
              height: 4,
              borderRadius: "var(--radius-full)",
              background: "var(--accent-primary)",
              transition: "width 0.05s linear",
            }}
          />
          {/* Thumb */}
          <div
            className="ui-scrub__thumb"
            style={{
              position: "absolute",
              left: `${progress}%`,
              transform: "translateX(-50%)",
              width: 12,
              height: 12,
              borderRadius: "var(--radius-full)",
              background: "var(--on-accent)",
              boxShadow: "var(--shadow-thumb)",
              transition: "left 0.05s linear",
              pointerEvents: "none",
            }}
          />
          {/* Invisible range input for interaction */}
          <input
            type="range"
            aria-label="Playback position"
            min={0}
            max={maxTime}
            step={0.01}
            value={displayTime}
            onChange={handleScrub}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              width: "100%",
              height: 16,
              opacity: 0,
              cursor: "pointer",
            }}
          />
        </div>
        <span
          style={{
            fontSize: "var(--fs-caption)",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            minWidth: 32,
            textAlign: "right",
          }}
        >
          {formatTime(maxTime)}
        </span>
      </div>
    </div>
  );
}

function TransportDivider() {
  return <div aria-hidden="true" style={{ width: 1, height: 16, background: "var(--border-color)" }} />;
}
