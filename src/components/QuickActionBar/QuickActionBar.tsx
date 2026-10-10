import { useAudioStore } from "../../stores/audioStore";
import { useChartStore } from "../../stores/chartStore";
import { audioEngine } from "../../audio/audioEngine";
import { beatToFloat } from "../../types/chart";
import { BpmList } from "../../utils/bpmList";
import { useMemo } from "react";
import { Play, Pause, Square } from "lucide-react";
import { IconButton } from "../common/IconButton";
import { SegmentedControl } from "../common/SegmentedControl";

// ============================================================
// CONFIGURABLE: Available playback speed presets
// ============================================================
const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0];

/** Default max time (seconds) when no audio is loaded */
const DEFAULT_MAX_TIME = 120;

export function QuickActionBar() {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);
  const duration = useAudioStore((s) => s.duration);
  const playbackRate = useAudioStore((s) => s.playbackRate);
  const togglePlayPause = useAudioStore((s) => s.togglePlayPause);
  const seek = useAudioStore((s) => s.seek);
  const setPlaybackRate = useAudioStore((s) => s.setPlaybackRate);

  const bpmList = useChartStore((s) => s.chart.bpm_list);
  const lines = useChartStore((s) => s.chart.lines);

  // Compute the effective max time for the slider
  const maxTime = useMemo(() => {
    if (duration > 0) return duration;

    // Estimate from chart content: find the latest beat across all notes/events
    let maxBeat = 0;
    for (const line of lines) {
      for (const note of line.notes) {
        const b = beatToFloat(note.beat);
        if (note.hold_beat) maxBeat = Math.max(maxBeat, b + beatToFloat(note.hold_beat));
        else maxBeat = Math.max(maxBeat, b);
      }
      for (const ev of line.events) {
        maxBeat = Math.max(maxBeat, beatToFloat(ev.end_beat));
      }
    }

    if (maxBeat > 0) {
      const bl = new BpmList(bpmList);
      // Add some padding (4 beats)
      return bl.timeAt([Math.ceil(maxBeat) + 4, 0, 1]);
    }
    return DEFAULT_MAX_TIME;
  }, [duration, lines, bpmList]);

  const progressPercent = maxTime > 0 ? (currentTime / maxTime) * 100 : 0;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1);
    return m > 0 ? `${m}:${s.padStart(4, "0")}` : `${t.toFixed(2)}s`;
  };

  return (
    <div
      className="flex items-center h-8 px-3 gap-3 flex-shrink-0"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "var(--rule) solid var(--border-color)",
      }}
    >
      {/* ---- Transport Controls ---- */}
      <div className="flex items-center gap-1">
        <IconButton
          icon={isPlaying ? Pause : Play}
          label={isPlaying ? "Pause" : "Play"}
          shortcut="Space"
          size="md"
          tooltipPosition="bottom"
          style={{ color: "var(--text-primary)" }}
          onClick={togglePlayPause}
        />
        <IconButton
          icon={Square}
          label="Stop"
          size="md"
          tooltipPosition="bottom"
          style={{ color: "var(--text-primary)" }}
          onClick={() => audioEngine.stop()}
        />
      </div>

      {/* ---- Divider ---- */}
      <div className="w-px h-4" style={{ backgroundColor: "var(--border-color)" }} />

      {/* ---- Speed Control ---- */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Speed</span>
        <SegmentedControl
          options={SPEED_PRESETS.map((s) => ({ value: s, label: `${s}×` }))}
          value={playbackRate}
          onChange={setPlaybackRate}
          tone="accent"
          size="sm"
          label="Playback speed"
        />
      </div>

      {/* ---- Spacer pushes the rest to the right ---- */}
      <div className="flex-1" />

      {/* ---- Progress Slider ---- */}
      <div className="flex items-center gap-2 w-72">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={Math.min(progressPercent, 100)}
          onChange={(e) => seek((Number(e.target.value) / 100) * maxTime)}
          aria-label="Playback position"
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: "var(--accent-primary)" }}
        />
        <span
          className="text-xs font-mono w-12 text-right"
          style={{ color: "var(--text-secondary)" }}
        >
          {formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}
