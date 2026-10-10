// ============================================================
// New Chart Dialog — sectioned card layout on the shared Dialog
//
// File drop zones (filled bg-active wells with a dashed hairline
// outline), a chart-info card with difficulty selector, and a
// timing card. Chrome (overlay, header, close, footer) comes from
// the shared <Dialog>.
// ============================================================

import { useState, useRef } from "react";
import { FilePlus, Music, Image as ImageIcon, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { useAudioStore } from "../../stores/audioStore";
import { selectLineByIndex } from "../../stores/selection";
import { useTabStore } from "../../stores/tabStore";
import { audioEngine } from "../../audio/audioEngine";
import { isTauri, pickFile, createProject, loadProject } from "../../utils/ipc";
import { saveActiveChartSession, registerSession, setSkipNextSave, setSkipNextRestore, setAudioBlobUrl, setStoredProjectId } from "../../utils/chartSessions";
import { useRecentProjectsStore } from "../../stores/recentProjectsStore";
import { saveStoredProject } from "../../utils/projectStorage";
import type { ProjectMeta, PhichainChart } from "../../types/chart";
import { safeParseNumber, NumericInput } from "../common/FormFields";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";
import { Kbd } from "../common/Kbd";
import { SegmentedControl } from "../common/SegmentedControl";
import { INPUT_STYLE as KIT_INPUT_STYLE } from "../common/UIKit";

interface Props {
  open: boolean;
  onClose: () => void;
}

/* ── Reusable sub-components ── */

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "var(--fs-control)",
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: "var(--space-8)",
      }}
    >
      {children}
    </div>
  );
}

const DIFFICULTY_OPTIONS = [
  { value: "EZ", label: "EZ" },
  { value: "HD", label: "HD" },
  { value: "IN", label: "IN" },
  { value: "AT", label: "AT" },
];

const INPUT_STYLE: React.CSSProperties = {
  ...KIT_INPUT_STYLE,
  width: "100%",
  height: "var(--control-lg)",
  padding: "0 var(--space-10)",
  fontSize: "var(--fs-body)",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-control)",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "var(--space-4)",
};

/* ── File Drop Zone ── */

function DropZone({
  icon,
  title,
  description,
  extensions,
  fileName,
  dragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onClear,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  extensions: string;
  fileName: string | null;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  onClear: () => void;
}) {
  const clickable = !fileName;
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${title}: ${description}` : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      } : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `var(--hairline) dashed ${dragOver ? "var(--accent-primary)" : "var(--border-color)"}`,
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-16)",
        textAlign: "center",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color var(--dur-fast), background-color var(--dur-fast)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-6)",
        backgroundColor: dragOver ? "var(--accent-wash)" : "var(--bg-active)",
      }}
    >
      <Icon
        icon={icon}
        size={20}
        style={{ color: dragOver || fileName ? "var(--accent-primary)" : "var(--text-secondary)" }}
      />
      {fileName ? (
        <>
          <div style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-all" }}>
            {fileName}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            Remove
          </Button>
        </>
      ) : (
        <>
          <div style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)", fontWeight: 500 }}>{title}</div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{description}</div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{extensions}</div>
        </>
      )}
    </div>
  );
}

/* ── Card Row ── */

function CardRow({
  label,
  children,
  last = false,
  side,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  side?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "var(--space-10) var(--space-14)",
        borderBottom: last ? "none" : "var(--rule) solid var(--separator)",
        display: side ? "flex" : undefined,
      }}
    >
      {side ? (
        <>
          <div style={{ flex: 1 }}>
            <label style={LABEL_STYLE}>{label}</label>
            {children}
          </div>
          <div style={{ width: 160, paddingLeft: "var(--space-14)", marginLeft: "var(--space-14)", borderLeft: "var(--rule) solid var(--separator)" }}>
            {side}
          </div>
        </>
      ) : (
        <>
          <label style={LABEL_STYLE}>{label}</label>
          {children}
        </>
      )}
    </div>
  );
}

/* ── Main Dialog ── */

export function NewProjectDialog({ open, onClose }: Props) {
  const [meta, setMeta] = useState<ProjectMeta>({
    name: "",
    composer: "",
    charter: "",
    illustrator: "",
    level: "",
  });
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicPath, setMusicPath] = useState<string | null>(null);
  const [illustrationFile, setIllustrationFile] = useState<File | null>(null);
  const [illustrationPath, setIllustrationPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [difficulty, setDifficulty] = useState<string>("IN");
  const [levelNumber, setLevelNumber] = useState(15);
  const [initialBpm, setInitialBpm] = useState(120);
  const [dragOverMusic, setDragOverMusic] = useState(false);
  const [dragOverIllustration, setDragOverIllustration] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const illustrationInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const musicName = musicFile?.name ?? musicPath?.split(/[\\/]/).pop() ?? null;
  const illustrationName = illustrationFile?.name ?? illustrationPath?.split(/[\\/]/).pop() ?? null;

  /** Extract metadata from the selected audio file and auto-fill empty fields. */
  const processAudioMetadata = async (file?: File, path?: string) => {
    try {
      const { extractMetadataFromFile, extractMetadataFromPath } = await import("../../utils/audioMetadata");
      const audioMeta = file
        ? await extractMetadataFromFile(file)
        : path
          ? await extractMetadataFromPath(path)
          : null;
      if (!audioMeta) return;

      setMeta((prev) => ({
        ...prev,
        name: prev.name || audioMeta.title || "",
        composer: prev.composer || audioMeta.artist || "",
      }));

      if (audioMeta.coverArt && !illustrationFile && !illustrationPath) {
        const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
        const ext = extMap[audioMeta.coverArt.format] ?? "jpg";
        const coverFile = new File(
          [audioMeta.coverArt.data.slice()],
          `cover.${ext}`,
          { type: audioMeta.coverArt.format },
        );
        setIllustrationFile(coverFile);
        setIllustrationPath(null);
      }
    } catch {
      // Metadata extraction is best-effort — silently ignore failures
    }
  };

  const handlePickMusic = async () => {
    if (isTauri()) {
      const path = await pickFile([
        { name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "m4a"] },
      ]);
      if (path) {
        setMusicPath(path);
        setMusicFile(null);
        setError(null);
        processAudioMetadata(undefined, path);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMusicFile(file);
      setMusicPath(null);
      setError(null);
      processAudioMetadata(file);
    }
  };

  const handlePickIllustration = async () => {
    if (isTauri()) {
      const path = await pickFile([
        { name: "Image", extensions: ["png", "jpg", "jpeg", "webp"] },
      ]);
      if (path) {
        setIllustrationPath(path);
        setIllustrationFile(null);
        setError(null);
      }
    } else {
      illustrationInputRef.current?.click();
    }
  };

  const handleIllustrationFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIllustrationFile(file);
      setIllustrationPath(null);
      setError(null);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    // Compose level from difficulty + number
    const composedLevel = `${difficulty} Lv.${levelNumber}`;
    const finalMeta = { ...meta, level: composedLevel };

    try {
      let musicUrl: string | null = null;

      // Save the outgoing chart's session under its real owning tab id before
      // loadFromProjectData replaces the chart store (finding L5/H2: the old
      // positional "last chart-like tab" fallback could overwrite a different
      // chart's session).
      saveActiveChartSession();

      setSkipNextSave();

      if (isTauri() && musicPath) {
        const folderPath = musicPath.replace(/[\\/][^\\/]+$/, "") + "/" + (finalMeta.name || "new-chart");
        await createProject(folderPath, finalMeta, musicPath, illustrationPath ?? undefined);

        const projectData = await loadProject(folderPath);
        const cs = useChartStore.getState();
        cs.loadFromProjectData(projectData);

        if (projectData.music_path) {
          const { readAudioFileAsUrl } = await import("../../utils/ipc");
          const url = await readAudioFileAsUrl(projectData.music_path);
          const ext = projectData.music_path.split(".").pop()?.toLowerCase() ?? "mp3";
          await audioEngine.load(url, ext);
          useAudioStore.getState().setMusicLoaded(true);
        }

        if (projectData.illustration_path) {
          const { readImageFileAsUrl } = await import("../../utils/ipc");
          const illustUrl = await readImageFileAsUrl(projectData.illustration_path);
          await cs.loadIllustration(illustUrl);
        }

        selectLineByIndex(0);

        useTabStore.getState().openChart(folderPath, finalMeta.name || "Untitled Chart");
        const tabId = useTabStore.getState().getChartTabId(folderPath);
        setSkipNextRestore();
        registerSession(tabId);

        useRecentProjectsStore.getState().addRecent({
          id: crypto.randomUUID(),
          name: finalMeta.name || "Untitled",
          composer: finalMeta.composer || "",
          level: composedLevel,
          lineCount: 1,
          noteCount: 0,
          importType: "new",
          projectPath: folderPath,
        });

        onClose();
        return;
      }

      if (musicFile) {
        const objectUrl = URL.createObjectURL(musicFile);
        const ext = musicFile.name.split(".").pop()?.toLowerCase() ?? "mp3";
        await audioEngine.load(objectUrl, ext);
        useAudioStore.getState().setMusicLoaded(true);
        musicUrl = objectUrl;
        // Track the blob URL + format so tab session restore can reuse it
        setAudioBlobUrl(objectUrl, ext);
      }

      let illustrationUrl: string | null = null;
      if (illustrationFile) {
        illustrationUrl = URL.createObjectURL(illustrationFile);
      }

      const defaultChart: PhichainChart = {
        format: 1,
        offset: 0,
        bpm_list: [{ beat: [0, 0, 1], bpm: initialBpm }],
        lines: [
          {
            name: "Line 1",
            notes: [],
            // No baseline events (finding L4): defaults render this line visible
            // at the origin, speed 10. grep DEFAULT_LINE_STATE.
            events: [],
            children: [],
            curve_note_tracks: [],
          },
        ],
      };

      const cs = useChartStore.getState();
      cs.loadFromProjectData({
        chart_json: JSON.stringify(defaultChart),
        meta: finalMeta,
        project_path: "in-memory",
        music_path: musicUrl ?? "",
        illustration_path: null,
      });

      if (illustrationUrl) {
        await cs.loadIllustration(illustrationUrl);
      }

      selectLineByIndex(0);

      const chartId = `browser-${Date.now()}`;
      useTabStore.getState().openChart(chartId, finalMeta.name || "Untitled Chart");
      const tabId = useTabStore.getState().getChartTabId(chartId);
      setSkipNextRestore();

      // Persist the project data to IndexedDB BEFORE registering the
      // session, so the freshly-registered session snapshot already
      // carries the IndexedDB id (bug audit #4 rematerialization path).
      const projectId = crypto.randomUUID();
      await saveStoredProject({
        id: projectId,
        chartJson: JSON.stringify(defaultChart),
        meta: finalMeta,
        audioBlob: musicFile ? await musicFile.arrayBuffer() : null,
        audioExt: musicFile ? (musicFile.name.split(".").pop()?.toLowerCase() ?? null) : null,
        illustrationBlob: illustrationFile ? await illustrationFile.arrayBuffer() : null,
        savedAt: Date.now(),
      });
      setStoredProjectId(projectId);

      // Now that the tracker is set, snapshot the session.
      registerSession(tabId);
      useRecentProjectsStore.getState().addRecent({
        id: projectId,
        name: finalMeta.name || "Untitled",
        composer: finalMeta.composer || "",
        level: composedLevel,
        lineCount: 1,
        noteCount: 0,
        importType: "new",
      });

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleFileInput} />
      <input ref={illustrationInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleIllustrationFileInput} />

      <Dialog
        title="New chart"
        icon={FilePlus}
        onClose={onClose}
        width={480}
        footer={
          <>
            <Kbd style={{ marginRight: "auto" }}>Ctrl+N</Kbd>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={creating} onClick={handleCreate}>
              {creating ? "Creating…" : "Create chart"}
            </Button>
          </>
        }
      >
        {/* Files section */}
        <div style={{ marginBottom: "var(--space-20)" }}>
          <SectionHeader>Files</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-10)" }}>
            <DropZone
              icon={Music}
              title="Music file"
              description="Drop audio or click to browse"
              extensions=".mp3 .wav .ogg .flac"
              fileName={musicName}
              dragOver={dragOverMusic}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverMusic(true); }}
              onDragLeave={() => setDragOverMusic(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOverMusic(false);
                const file = e.dataTransfer.files?.[0];
                if (file && /\.(mp3|wav|ogg|flac|m4a)$/i.test(file.name)) {
                  setMusicFile(file); setMusicPath(null); setError(null);
                  processAudioMetadata(file);
                }
              }}
              onClick={handlePickMusic}
              onClear={() => { setMusicFile(null); setMusicPath(null); }}
            />
            <DropZone
              icon={ImageIcon}
              title="Illustration"
              description="Drop image or click to browse"
              extensions=".png .jpg .webp"
              fileName={illustrationName}
              dragOver={dragOverIllustration}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIllustration(true); }}
              onDragLeave={() => setDragOverIllustration(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOverIllustration(false);
                const file = e.dataTransfer.files?.[0];
                if (file && /\.(png|jpg|jpeg|webp)$/i.test(file.name)) {
                  setIllustrationFile(file); setIllustrationPath(null); setError(null);
                }
              }}
              onClick={handlePickIllustration}
              onClear={() => { setIllustrationFile(null); setIllustrationPath(null); }}
            />
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-8)", textAlign: "center" }}>
            Both files are optional — you can add them later
          </div>
        </div>

        {/* Chart info section */}
        <div style={{ marginBottom: "var(--space-20)" }}>
          <SectionHeader>Chart info</SectionHeader>
          <div style={{ backgroundColor: "var(--bg-active)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <CardRow label="Song name">
              <input
                style={INPUT_STYLE}
                value={meta.name}
                onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                placeholder="e.g. Aegleseeker"
              />
            </CardRow>
            <CardRow label="Composer">
              <input
                style={INPUT_STYLE}
                value={meta.composer}
                onChange={(e) => setMeta({ ...meta, composer: e.target.value })}
                placeholder="e.g. silentroom"
              />
            </CardRow>
            <CardRow label="Charter">
              <input
                style={INPUT_STYLE}
                value={meta.charter}
                onChange={(e) => setMeta({ ...meta, charter: e.target.value })}
                placeholder="Your name"
              />
            </CardRow>
            <CardRow
              label="Illustrator"
              last
              side={
                <div>
                  <label style={LABEL_STYLE}>Difficulty</label>
                  <SegmentedControl
                    value={difficulty}
                    options={DIFFICULTY_OPTIONS}
                    onChange={setDifficulty}
                    tone="accent"
                    size="sm"
                    block
                    label="Difficulty"
                  />
                  <div className="flex items-center" style={{ gap: "var(--space-6)", marginTop: "var(--space-8)" }}>
                    <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>Lv.</span>
                    <input
                      type="number"
                      aria-label="Level"
                      value={levelNumber}
                      onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setLevelNumber(Math.trunc(n)); }}
                      style={{
                        ...INPUT_STYLE,
                        width: 56,
                        height: "var(--control-md)",
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                  </div>
                </div>
              }
            >
              <input
                style={INPUT_STYLE}
                value={meta.illustrator}
                onChange={(e) => setMeta({ ...meta, illustrator: e.target.value })}
                placeholder="Artist name"
              />
            </CardRow>
          </div>
        </div>

        {/* Timing section */}
        <div>
          <SectionHeader>Timing</SectionHeader>
          <div style={{ backgroundColor: "var(--bg-active)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div
              className="flex items-center justify-between"
              style={{ padding: "var(--space-12) var(--space-14)", gap: "var(--space-12)" }}
            >
              <div>
                <div style={{ fontSize: "var(--fs-body)", color: "var(--text-primary)" }}>Initial BPM</div>
                <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: 1 }}>
                  You can add BPM changes later in the editor
                </div>
              </div>
              <NumericInput
                aria-label="Initial BPM"
                commitMode="blur"
                min={1}
                fallback={120}
                value={initialBpm}
                onChange={setInitialBpm}
                style={{
                  ...INPUT_STYLE,
                  width: 72,
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: "var(--space-12)",
              padding: "var(--space-8) var(--space-12)",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--fs-body)",
              color: "var(--error)",
              backgroundColor: "color-mix(in srgb, var(--error) 10%, transparent)",
            }}
          >
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}
