// ============================================================
// Lyrics Sync Dialog — Bulk lyrics timing tool
//
// Paste lyrics, play audio, press Enter to mark each line's
// start beat, then commit all text events at once.
// Rendered in the shared Dialog chrome.
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { MicVocal, Play, Square } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useAudioStore } from "../../stores/audioStore";
import { useSelectedLineIndex } from "../../stores/selection";
import { useSettingsStore } from "../../stores/settingsStore";
import { audioEngine } from "../../audio/audioEngine";
import { getPlayheadBeat } from "../../utils/playhead";
import { floatToBeat } from "../../types/chart";
import type { LineEvent } from "../../types/chart";
import { ensureTextLine } from "../../utils/textEventHelpers";
import { INPUT_STYLE } from "../common/UIKit";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { ActionKbd, Kbd } from "../common/Kbd";

interface LyricsSyncDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LyricsSyncDialog({ open, onClose }: LyricsSyncDialogProps) {
  const [lyrics, setLyrics] = useState("");
  const [syncedBeats, setSyncedBeats] = useState<number[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const defaultDuration = useSettingsStore((s) => s.defaultTextDurationBeats);
  const selectedLineIndex = useSelectedLineIndex();

  const lines = lyrics.split("\n").filter((l) => l.trim().length > 0);
  const keyHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // D2: tie the global keydown lifecycle to BOTH isSyncing AND open. The
  // dialog component stays mounted while closed (App.tsx renders it
  // unconditionally, visibility is gated by `if (!open) return null`), so an
  // effect keyed only on isSyncing would keep this window-level listener
  // capturing Q/Enter after the dialog is dismissed mid-sync. grep
  // showLyricsSync in App.tsx for the mount site.
  useEffect(() => {
    if (!isSyncing || !open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "q" || e.key === "Q") {
        e.preventDefault();

        const beat = getPlayheadBeat({ clampNonNegative: true });

        setSyncedBeats((prev) => [...prev, beat]);
        setCurrentLyricIndex((prev) => {
          const next = prev + 1;
          if (next >= lines.length) {
            setIsSyncing(false);
          }
          return next;
        });
      }

      if (e.key === "Escape") {
        setIsSyncing(false);
      }
    };

    keyHandlerRef.current = handler;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSyncing, open, lines.length]);

  // D2: reset sync state on the close transition so a dialog dismissed mid-sync
  // (Cancel / backdrop / Apply) drops out of syncing and the keydown effect
  // above tears its listener down. Resets here instead of inside each close
  // path because there are several (onClose is called from 3 sites).
  useEffect(() => {
    if (open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSyncing(false);
    setSyncedBeats([]);
    setCurrentLyricIndex(0);
  }, [open]);

  const startSync = useCallback(() => {
    if (lines.length === 0) return;
    setSyncedBeats([]);
    setCurrentLyricIndex(0);
    setIsSyncing(true);
    // Start playback
    if (!useAudioStore.getState().isPlaying) {
      audioEngine.play();
    }
  }, [lines.length]);

  const reset = useCallback(() => {
    setSyncedBeats([]);
    setCurrentLyricIndex(0);
    setIsSyncing(false);
  }, []);

  const applyAndClose = useCallback(() => {
    if (syncedBeats.length === 0 || lines.length === 0) return;

    const targetLineIndex = ensureTextLine(selectedLineIndex);

    const newEvents: LineEvent[] = [];
    for (let i = 0; i < Math.min(syncedBeats.length, lines.length); i++) {
      const startBeat = syncedBeats[i];
      const endBeat = i < syncedBeats.length - 1
        ? syncedBeats[i + 1]
        : startBeat + defaultDuration;

      newEvents.push({
        kind: "text",
        start_beat: floatToBeat(startBeat),
        end_beat: floatToBeat(endBeat),
        value: { text_value: lines[i] },
      });
    }

    const cs = useChartStore.getState();
    for (const event of newEvents) {
      cs.addEvent(targetLineIndex, event);
    }

    onClose();
  }, [syncedBeats, lines, selectedLineIndex, defaultDuration, onClose]);

  if (!open) return null;

  const progress = lines.length > 0 ? syncedBeats.length / lines.length : 0;

  return (
    <Dialog
      title="Lyrics sync"
      icon={MicVocal}
      onClose={onClose}
      width={420}
      // While syncing, Esc only stops syncing (handled by the keydown effect above).
      escapeToClose={!isSyncing}
      footer={
        !isSyncing ? (
          <>
            <Button variant="ghost" onClick={reset} disabled={syncedBeats.length === 0} style={{ marginRight: "auto" }}>
              Reset
            </Button>
            <Button onClick={onClose}>Cancel</Button>
            <Button icon={Play} onClick={startSync} disabled={lines.length === 0}>
              Start syncing
            </Button>
            <Button variant="primary" onClick={applyAndClose} disabled={syncedBeats.length === 0}>
              Apply
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button icon={Square} onClick={() => setIsSyncing(false)}>Stop syncing</Button>
          </>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <label htmlFor="lyrics-sync-text" style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
          Paste lyrics (one line per event)
        </label>
        <textarea
          id="lyrics-sync-text"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          placeholder={"Terror\nTerror is near\nI will\nshatter you all!!"}
          rows={8}
          style={{
            ...INPUT_STYLE,
            width: "100%",
            height: "auto",
            padding: "var(--space-6) var(--space-8)",
            resize: "vertical",
          }}
          disabled={isSyncing}
        />

        {/* Instructions */}
        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
          Press <ActionKbd action="toggle_playback" /> to play, then press <Kbd>Enter</Kbd> or <Kbd>Q</Kbd> each time a lyric line starts. Timing is recorded.
        </div>

        {/* Progress */}
        {lines.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                Progress: <span style={{ fontFamily: "var(--font-mono)" }}>{syncedBeats.length}/{lines.length}</span> lines synced
              </span>
            </div>
            <div style={{
              height: 4,
              backgroundColor: "var(--bg-active)",
              borderRadius: "var(--radius-full)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progress * 100}%`,
                backgroundColor: "var(--accent-primary)",
                borderRadius: "var(--radius-full)",
                transition: "width var(--dur-base)",
              }} />
            </div>
            {isSyncing && currentLyricIndex < lines.length && (
              <div style={{
                fontSize: "var(--fs-body)",
                color: "var(--accent-primary)",
                fontWeight: 600,
                marginTop: "var(--space-6)",
                textAlign: "center",
                padding: "var(--space-4) var(--space-8)",
                backgroundColor: "var(--accent-tint)",
                borderRadius: "var(--radius-md)",
              }}>
                "{lines[currentLyricIndex]}"
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
