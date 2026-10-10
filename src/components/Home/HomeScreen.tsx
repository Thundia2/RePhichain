// ============================================================
// Home Screen
//
// Two-column layout: main content (welcome, action cards,
// recent projects) + right sidebar (quick reference).
//
// "Clear all" and the per-row remove button (shown on row hover
// or keyboard focus) both ask first via showConfirm().
// ============================================================

import { useState } from "react";
import { useRecentProjectsStore } from "../../stores/recentProjectsStore";
import type { RecentProject } from "../../stores/recentProjectsStore";
import { loadStoredProject } from "../../utils/projectStorage";
import { useChartStore } from "../../stores/chartStore";
import { selectLineByIndex } from "../../stores/selection";
import { useTabStore } from "../../stores/tabStore";
import { useAudioStore } from "../../stores/audioStore";
import { audioEngine } from "../../audio/audioEngine";
import { useToastStore } from "../../stores/toastStore";
import {
  saveActiveChartSession,
  registerSession,
  setSkipNextSave,
  setSkipNextRestore,
  setStoredProjectId,
  setAudioBlobUrl,
  clearProjectAudio,
} from "../../utils/chartSessions";
import { FilePlus, FileInput, Music, X, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EditorGuideModal } from "./EditorGuideModal";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import { Button } from "../common/Button";
import { Kbd } from "../common/Kbd";
import { NoteGlyph } from "../common/NoteGlyph";
import type { NoteKind } from "../../types/chart";

interface HomeScreenProps {
  onNewChart: () => void;
  onImportChart: () => void;
}

// Note types (drawn with NoteGlyph in their note colours)
const NOTE_TYPES: { label: string; kind: NoteKind; key: string }[] = [
  { label: "Tap", kind: "tap", key: "Q" },
  { label: "Drag", kind: "drag", key: "W" },
  { label: "Flick", kind: "flick", key: "E" },
  { label: "Hold", kind: "hold", key: "R" },
];

const SHORTCUTS = [
  { label: "Play / pause", key: "Space" },
  { label: "Undo", key: "Ctrl+Z" },
  { label: "Redo", key: "Ctrl+Shift+Z" },
  { label: "Select tool", key: "V" },
  { label: "Eraser", key: "X" },
  { label: "Flip above/below", key: "F" },
  { label: "Delete selected", key: "Del" },
];

const TIPS = [
  "Set speed to 0 before a drop for dramatic freezes, then snap it back up.",
  "Use F to flip notes below the line for more complex patterns.",
  "Set opacity to 0 for invisible lines — a staple of hard charts.",
];

/** Sentence-case section label (11px / 600, text-secondary). */
const SECTION_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  lineHeight: "14px",
  fontWeight: 600,
  color: "var(--text-secondary)",
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

async function handleOpenRecent(project: RecentProject) {
  try {
    // Save the outgoing chart's session under its real owning tab id before
    // loadFromProjectData replaces the chart store (finding L5: the old
    // type-gated check skipped unrolled-editor tabs and mis-routed satellites).
    saveActiveChartSession();
    setSkipNextSave();

    // Tauri project with a folder on disk — reload via IPC
    if (project.projectPath) {
      const { loadProject, readAudioFileAsUrl, readImageFileAsUrl } = await import("../../utils/ipc");
      const projectData = await loadProject(project.projectPath);

      const cs = useChartStore.getState();
      cs.loadFromProjectData(projectData);

      if (projectData.music_path) {
        const url = await readAudioFileAsUrl(projectData.music_path);
        const ext = projectData.music_path.split(".").pop()?.toLowerCase() ?? "mp3";
        await audioEngine.load(url, ext);
        useAudioStore.getState().setMusicLoaded(true);
      } else {
        // E3: defensive — a disk project normally must have audio (the Rust loader
        // requires a music file), but if music_path is ever null don't leave the
        // previous project's song playing under this one.
        clearProjectAudio();
      }

      if (projectData.illustration_path) {
        const illustUrl = await readImageFileAsUrl(projectData.illustration_path);
        await cs.loadIllustration(illustUrl);
      }

      selectLineByIndex(0);
      useTabStore.getState().openChart(project.projectPath, project.name || "Untitled");
      setSkipNextRestore();
      registerSession(useTabStore.getState().getChartTabId(project.projectPath));
      return;
    }

    // Browser / in-memory project — load from IndexedDB
    const stored = await loadStoredProject(project.id);
    if (!stored) {
      useToastStore.getState().addToast({
        message: "Project data not found. It may have been cleared.",
        type: "error",
      });
      useRecentProjectsStore.getState().removeOne(project.timestamp);
      return;
    }

    const cs = useChartStore.getState();
    cs.loadFromProjectData({
      chart_json: stored.chartJson,
      meta: stored.meta,
      project_path: "",
      music_path: null,
      illustration_path: null,
    });

    if (stored.audioBlob && stored.audioExt) {
      const mimeTypes: Record<string, string> = { mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4" };
      const blob = new Blob([stored.audioBlob], { type: mimeTypes[stored.audioExt] ?? "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      // F5: publish the blob URL + format BEFORE awaiting the decode so a tab
      // switch mid-decode still snapshots this tab's audio source (see importChart).
      setAudioBlobUrl(url, stored.audioExt);
      await audioEngine.load(url, stored.audioExt);
      useAudioStore.getState().setMusicLoaded(true);
    } else {
      // E3: this recent project has no audio — unload any song still playing from
      // the previously open project (the swap leaves isLoaded true, so App's
      // close-time unload effect never fires here).
      clearProjectAudio();
    }

    // Bug audit #4: record the IndexedDB id so restoreSession can
    // rematerialize audio from disk if this tab's blob URL dies later.
    setStoredProjectId(project.id);

    // Restore illustration from saved blob (if available)
    if (stored.illustrationBlob) {
      const illuBlob = new Blob([stored.illustrationBlob]);
      const illuUrl = URL.createObjectURL(illuBlob);
      await cs.loadIllustration(illuUrl);
    }

    selectLineByIndex(0);
    const chartId = "recent-" + project.id;
    useTabStore.getState().openChart(chartId, project.name || "Untitled");
    setSkipNextRestore();
    registerSession(useTabStore.getState().getChartTabId(chartId));
  } catch (err) {
    console.error("Failed to open recent project:", err);
    useToastStore.getState().addToast({
      message: "Failed to open project. See console for details.",
      type: "error",
    });
  }
}

export function HomeScreen({ onNewChart, onImportChart }: HomeScreenProps) {
  const [showGuide, setShowGuide] = useState(false);
  // Which project row is hovered or holds keyboard focus — swaps the
  // timestamp for the remove button on that row.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const projects = useRecentProjectsStore((s) => s.projects);
  const clearAll = useRecentProjectsStore((s) => s.clearAll);
  const removeOne = useRecentProjectsStore((s) => s.removeOne);

  return (
    <div
      className="h-full"
      style={{ backgroundColor: "var(--bg-primary)", display: "flex", justifyContent: "center" }}
    >
      {/* Centered wrapper */}
      <div style={{ display: "flex", maxWidth: 900, width: "100%" }}>
      {/* Left: main content */}
      <div
        style={{
          flex: 1,
          padding: "var(--space-32) 40px",
          maxWidth: 640,
          overflowY: "auto",
        }}
      >
        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: "var(--fs-display)",
              lineHeight: "26px",
              fontWeight: 500,
              color: "var(--text-primary)",
              marginBottom: "var(--space-4)",
            }}
          >
            Welcome back
          </h1>
          <div style={{ fontSize: "var(--fs-body)", color: "var(--text-secondary)" }}>
            Create a new chart or pick up where you left off.
          </div>
        </div>

        {/* Action cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-10)",
            marginBottom: "var(--space-32)",
          }}
        >
          <ActionCard
            icon={FilePlus}
            primary
            title="New chart…"
            description="Start from scratch with a blank project."
            shortcut="Ctrl+N"
            onClick={onNewChart}
          />
          <ActionCard
            icon={FileInput}
            title="Import chart…"
            description="Open a chart file (.json, .zip, .pez, .pec)."
            shortcut="Ctrl+O"
            onClick={onImportChart}
          />
        </div>

        {/* Recent projects */}
        <div style={{ marginBottom: "var(--space-24)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: "var(--control-sm)",
              marginBottom: "var(--space-8)",
            }}
          >
            <h2 style={SECTION_STYLE}>Recent projects</h2>
            {projects.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const { showConfirm } = await import("../common/ConfirmDialog");
                  const n = projects.length;
                  if (await showConfirm("This only clears the list; your chart files stay where they are.", {
                    title: `Clear all ${n} recent projects?`,
                    confirmLabel: "Clear list",
                    danger: true,
                  })) {
                    clearAll();
                  }
                }}
              >
                Clear all
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <div
              style={{
                padding: "var(--space-32) var(--space-16)",
                textAlign: "center",
                fontSize: "var(--fs-body)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-secondary)",
                borderRadius: "var(--radius-xl)",
              }}
            >
              No recent projects
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {projects.map((project) => {
                const isHovered = hoveredId === project.id;
                const name = project.name || "Untitled";
                return (
                <div
                  key={project.id}
                  className="ui-hover"
                  // Hover/focus state only toggles which trailing control is shown
                  // (timestamp vs. remove button); the row wash comes from .ui-hover.
                  onMouseEnter={() => setHoveredId(project.id)}
                  onMouseLeave={(e) => {
                    // Keep the remove button visible while it (or the row) has focus.
                    if (!e.currentTarget.contains(document.activeElement)) setHoveredId(null);
                  }}
                  onFocus={() => setHoveredId(project.id)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoveredId(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    paddingRight: "var(--space-10)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {/* Open: a real button, so the remove button sits beside it rather than inside it. */}
                  <button
                    type="button"
                    aria-label={`Open ${name}`}
                    onClick={() => handleOpenRecent(project)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-12)",
                      padding: "var(--space-8) 0 var(--space-8) var(--space-10)",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      background: "transparent",
                      color: "inherit",
                      font: "inherit",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                  {/* Thumbnail */}
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--bg-active)",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={Music} size={16} />
                  </span>
                  {/* Info */}
                  <span style={{ display: "block", flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--fs-body)",
                        color: "var(--text-primary)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--fs-caption)",
                        color: "var(--text-secondary)",
                        marginTop: 1,
                      }}
                    >
                      {project.composer || "Unknown"}
                      {project.level ? ` · ${project.level}` : ""}
                      {project.lineCount
                        ? ` · ${project.lineCount} lines`
                        : ""}
                      {project.noteCount
                        ? ` · ${project.noteCount.toLocaleString()} notes`
                        : ""}
                    </span>
                  </span>
                  {/* Time (hidden on hover/focus) + remove button (shown on hover/focus) */}
                  <span
                    style={{
                      fontSize: "var(--fs-caption)",
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                      display: isHovered ? "none" : "block",
                    }}
                  >
                    {timeAgo(project.timestamp)}
                  </span>
                  </button>
                  <IconButton
                    icon={X}
                    size="md"
                    danger
                    label="Remove from recent projects"
                    style={{ display: isHovered ? undefined : "none" }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const { showConfirm } = await import("../common/ConfirmDialog");
                      if (await showConfirm("The chart files on disk are not deleted.", {
                        title: `Remove "${name}" from recent projects?`,
                        confirmLabel: "Remove",
                        danger: true,
                      })) {
                        removeOne(project.timestamp);
                      }
                    }}
                  />
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: quick reference sidebar */}
      <div
        style={{
          width: 260,
          borderLeft: "var(--rule) solid var(--border-color)",
          padding: "var(--space-24) var(--space-20)",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            fontSize: "var(--fs-headline)",
            lineHeight: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "var(--space-14)",
          }}
        >
          Quick reference
        </h2>

        {/* Note types */}
        <div style={{ marginBottom: "var(--space-20)" }}>
          <h3 style={{ ...SECTION_STYLE, marginBottom: "var(--space-8)" }}>Note types</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {NOTE_TYPES.map((nt) => (
              <div
                key={nt.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-8)",
                  fontSize: "var(--fs-control)",
                }}
              >
                <NoteGlyph kind={nt.kind} size={14} />
                <span style={{ color: "var(--text-primary)" }}>{nt.label}</span>
                <span style={{ flex: 1 }} />
                <Kbd>{nt.key}</Kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Essential shortcuts */}
        <div style={{ marginBottom: "var(--space-20)" }}>
          <h3 style={{ ...SECTION_STYLE, marginBottom: "var(--space-8)" }}>Essential shortcuts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {SHORTCUTS.map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "var(--fs-control)",
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <Kbd>{s.key}</Kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div>
          <h3 style={{ ...SECTION_STYLE, marginBottom: "var(--space-8)" }}>Tips</h3>
          <div
            style={{
              fontSize: "var(--fs-control)",
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}
          >
            {TIPS.map((tip, i) => (
              <p key={i} style={{ marginBottom: i < TIPS.length - 1 ? "var(--space-6)" : 0 }}>
                {tip}
              </p>
            ))}
          </div>
          <Button
            block
            icon={BookOpen}
            style={{ marginTop: "var(--space-12)" }}
            onClick={() => setShowGuide(true)}
          >
            Open editor guide…
          </Button>
        </div>
      </div>

      </div>
      <EditorGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
    </div>
  );
}

// Action card sub-component
// bg-active radius-xl button: 28px icon chip, 13px/600 title,
// 11px description, shortcut chip. Hover wash comes from .ui-btn.
function ActionCard({
  icon,
  primary,
  title,
  description,
  shortcut,
  onClick,
}: {
  icon: LucideIcon;
  /** The main action: accent-tint chip with an accent icon. */
  primary?: boolean;
  title: string;
  description: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ui-btn"
      style={{
        height: "auto",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-14) var(--space-16)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: "var(--space-6)",
        textAlign: "left",
        whiteSpace: "normal",
        fontWeight: 400,
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--radius-md)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            backgroundColor: primary ? "var(--accent-tint)" : "var(--fill-hover)",
            color: primary ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          <Icon icon={icon} size={16} />
        </span>
        <span
          style={{
            fontSize: "var(--fs-headline)",
            lineHeight: "18px",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </span>
      </div>
      <div style={{ fontSize: "var(--fs-control)", lineHeight: "15px", color: "var(--text-secondary)" }}>
        {description}
      </div>
      <Kbd style={{ marginTop: "var(--space-2)" }}>{shortcut}</Kbd>
    </button>
  );
}
