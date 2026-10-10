// ============================================================
// Render smoke-test harness (DEV ONLY)
//
// Owns: a window.__smoke API that loads a real chart folder into the
// live stores — WITHOUT the file picker — so the Canvas2D / Pixi
// renderers can be driven and screenshotted headlessly (preview_eval).
// This is the repeatable counterpart to the manual `triggerImportChart`
// flow; it replicates importChart.ts's post-parse store sequence
// (loadFromProjectData → extraConfig → illustration → textures → font →
// audio → openChart). Keep the two in sync if importChart changes.
//
// Installed from main.tsx's `import.meta.env.DEV` block, so it is tree-
// shaken out of production. Pairs with scripts/render-smoke.md (how to
// run it) and the gitignored public/test-charts/<name>/ fixtures.
//
// Why this exists: the Wave-2/3 renderer + Pixi fixes (X1/X2/Q-series,
// C-series, L4 defaults) need a live RPE chart to validate; unit tests
// only cover the pure math. grep __smoke / render-smoke.
// ============================================================

import { useChartStore } from "../stores/chartStore";
import { useTabStore } from "../stores/tabStore";
import { useAudioStore } from "../stores/audioStore";
import { useSettingsStore } from "../stores/settingsStore";
import { audioEngine } from "../audio/audioEngine";
import { convertRpeToPhichain, extractRpeMeta } from "../utils/rpeImport";
import { detectChartFormat } from "../utils/chartFormatDetect";
import {
  saveActiveChartSession,
  setSkipNextSave,
  setSkipNextRestore,
  registerSession,
  setAudioBlobUrl,
} from "../utils/chartSessions";
import type { ExtraConfig } from "../types/extra";

interface LoadOpts {
  /** Override the chart JSON filename (default: info.yml `chart:`). */
  chartFile?: string;
  /** Override the audio filename (default: info.yml `music:`). */
  musicFile?: string;
  /** Override the illustration filename (default: info.yml `illustration:`). */
  illustrationFile?: string;
  /** extra.json filename (default: "extra.json"). */
  extraFile?: string;
  /** Custom font filename to load as ChartCustomFont (default: none). */
  fontFile?: string;
  /** Decode audio too (slower; needed for onset / hit-sound). Default true. */
  audio?: boolean;
}

interface StageLog {
  stage: string;
  ok: boolean;
  detail?: string;
}

export interface SmokeReport {
  base: string;
  format: string;
  lines: number;
  notes: number;
  isLoaded: boolean;
  activeTab: string;
  durationSec: number;
  effects: number;
  videos: number;
  textures: string[];
  log: StageLog[];
}

/** Read one `key: value` line out of a Phira info.yml blob. */
function pickYml(yml: string, key: string): string {
  return (yml.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1] ?? "").trim();
}

/**
 * Load a chart folder served under `base` (e.g. "/test-charts/solarflare")
 * into the live editor. Returns a structured report; never throws — every
 * stage is wrapped so a partial failure (e.g. a missing font) still loads the
 * chart and surfaces in `report.log`.
 */
async function loadChartFromUrl(base: string, opts: LoadOpts = {}): Promise<SmokeReport> {
  const log: StageLog[] = [];
  const step = async (stage: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      log.push({ stage, ok: true });
    } catch (e) {
      log.push({ stage, ok: false, detail: String((e as Error)?.message ?? e) });
    }
  };

  // Resolve filenames from info.yml (overridable).
  let chartFile = opts.chartFile ?? "";
  let musicFile = opts.musicFile ?? "";
  let illustrationFile = opts.illustrationFile ?? "";
  await step("info.yml", async () => {
    const yml = await (await fetch(`${base}/info.yml`)).text();
    chartFile ||= pickYml(yml, "chart");
    musicFile ||= pickYml(yml, "music");
    illustrationFile ||= pickYml(yml, "illustration");
  });
  if (!chartFile) throw new Error(`No chart file (set opts.chartFile or provide ${base}/info.yml)`);

  // Parse the chart (auto-detect; RPE is the path these Phira fixtures take).
  const chartText = await (await fetch(`${base}/${chartFile}`)).text();
  const format = detectChartFormat(chartText);
  if (format !== "rpe") {
    throw new Error(`Smoke harness currently loads RPE charts only (detected: ${format})`);
  }
  const chart = convertRpeToPhichain(chartText);
  const meta = extractRpeMeta(chartText);

  const textures = [
    ...new Set(chart.lines.map((l) => l.texture).filter((t): t is string => !!t && t !== "line.png")),
  ];

  const cs = useChartStore.getState();

  await step("loadFromProjectData", () => {
    saveActiveChartSession();
    setSkipNextSave();
    cs.loadFromProjectData({
      project_path: "",
      music_path: null,
      illustration_path: null,
      meta,
      chart_json: JSON.stringify(chart),
    });
  });

  await step("extraConfig", async () => {
    const res = await fetch(`${base}/${opts.extraFile ?? "extra.json"}`);
    if (res.ok) useChartStore.getState().setExtraConfig((await res.json()) as ExtraConfig);
  });

  await step("illustration", async () => {
    if (!illustrationFile) return;
    const blob = await (await fetch(`${base}/${illustrationFile}`)).blob();
    await useChartStore.getState().loadIllustration(URL.createObjectURL(blob));
  });

  await step("textures", async () => {
    for (const t of textures) {
      const res = await fetch(`${base}/${t}`);
      if (res.ok) useChartStore.getState().setLineTexture(t, await res.blob());
    }
  });

  if (opts.fontFile) {
    await step("font", async () => {
      const blob = await (await fetch(`${base}/${opts.fontFile}`)).blob();
      const url = URL.createObjectURL(blob);
      const ff = new FontFace("ChartCustomFont", `url(${url})`);
      await ff.load();
      document.fonts.add(ff);
      useChartStore.getState().setChartFontFamily("ChartCustomFont");
    });
  }

  if (opts.audio !== false && musicFile) {
    await step("audio", async () => {
      const ext = musicFile.split(".").pop()?.toLowerCase() ?? "mp3";
      const blob = await (await fetch(`${base}/${musicFile}`)).blob();
      const url = URL.createObjectURL(blob);
      setAudioBlobUrl(url, ext);
      await audioEngine.load(url, ext);
      useAudioStore.getState().setMusicLoaded(true);
    });
  }

  await step("openChart", () => {
    const id = "smoke-" + base.split("/").filter(Boolean).pop();
    saveActiveChartSession();
    setSkipNextSave();
    useTabStore.getState().openChart(id, meta.name || "Smoke Chart");
    setSkipNextRestore();
    registerSession(useTabStore.getState().getChartTabId(id));
  });

  return buildReport(base, format, log);
}

function buildReport(base: string, format: string, log: StageLog[]): SmokeReport {
  const cs = useChartStore.getState();
  const as = useAudioStore.getState();
  const ts = useTabStore.getState();
  let notes = 0;
  for (const l of cs.chart.lines) notes += l.notes?.length ?? 0;
  const textures = [
    ...new Set(cs.chart.lines.map((l) => l.texture).filter((t): t is string => !!t && t !== "line.png")),
  ];
  return {
    base,
    format,
    lines: cs.chart.lines.length,
    notes,
    isLoaded: cs.isLoaded,
    activeTab: ts.activeTabId,
    durationSec: as.duration,
    effects: cs.extraConfig?.effects?.length ?? 0,
    videos: cs.extraConfig?.videos?.length ?? 0,
    textures,
    log,
  };
}

/** Move the playhead (seconds) without playing — drives the render `time`. */
function seek(seconds: number): void {
  useAudioStore.getState().seek(seconds);
}

/**
 * Toggle the GPU (Pixi) renderer and remount the editor canvas. The renderer
 * is chosen at canvas mount (UnifiedCanvas init effect reads usePixiRenderer
 * once), so flipping the flag requires a remount — bounce the active tab via
 * Home. Returns after Pixi's async init settles.
 */
async function setPixi(enabled: boolean): Promise<void> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  useSettingsStore.getState().updateSettings({ usePixiRenderer: enabled });
  const ts = useTabStore.getState();
  const editorTab = ts.tabs.find((t) => t.id.startsWith("unified:") || t.id.startsWith("chart:"));
  if (!editorTab) return;
  ts.setActiveTab("home");
  await sleep(150);
  useTabStore.getState().setActiveTab(editorTab.id);
  await sleep(600);
}

export interface SmokeApi {
  loadChartFromUrl: typeof loadChartFromUrl;
  seek: typeof seek;
  setPixi: typeof setPixi;
  report: () => SmokeReport;
}

/** Install window.__smoke (DEV builds only — called from main.tsx). */
export function installSmokeHarness(): void {
  (window as unknown as { __smoke: SmokeApi }).__smoke = {
    loadChartFromUrl,
    seek,
    setPixi,
    report: () => buildReport("(current)", "rpe", []),
  };
}
