// ============================================================
// Chrome theme for Canvas2D renderers
//
// Canvas code can't use CSS variables directly, so this reads the
// design tokens from :root (src/index.css) once and caches them.
// Every timeline / event / curve canvas draws its chrome (grid,
// gutters, labels, playhead, selection) from here, so a token change
// in index.css reaches the canvases too. Falls back to the token
// values when there is no DOM (unit tests).
//
//   const t = chromeTheme();
//   ctx.fillStyle = t.bgPrimary;
//   ctx.font = monoFont(10);
// ============================================================

export interface ChromeTheme {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgActive: string;
  canvasBg: string;
  fillHover: string;
  fillStrong: string;
  borderColor: string;
  separator: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentHover: string;
  accentSelected: string;
  accentTint: string;
  onAccent: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  noteTap: string;
  noteDrag: string;
  noteHold: string;
  noteFlick: string;
  selectionColor: string;
  indicatorColor: string;
  onsetColor: string;
  beatLinePrimary: string;
  beatLineSecondary: string;
  fontSans: string;
  fontMono: string;
}

const TOKENS: Record<keyof ChromeTheme, [cssVar: string, fallback: string]> = {
  bgPrimary: ["--bg-primary", "#111118"],
  bgSecondary: ["--bg-secondary", "#16161d"],
  bgTertiary: ["--bg-tertiary", "#1a1a22"],
  bgActive: ["--bg-active", "#222230"],
  canvasBg: ["--canvas-bg", "#000000"],
  fillHover: ["--fill-hover", "rgba(255, 255, 255, 0.05)"],
  fillStrong: ["--fill-strong", "rgba(255, 255, 255, 0.10)"],
  borderColor: ["--border-color", "#2a2a35"],
  separator: ["--separator", "rgba(42, 42, 53, 0.55)"],
  textPrimary: ["--text-primary", "#e0e0e8"],
  textSecondary: ["--text-secondary", "#888888"],
  textMuted: ["--text-muted", "#555555"],
  accentPrimary: ["--accent-primary", "#6c8aff"],
  accentHover: ["--accent-hover", "#8aa4ff"],
  accentSelected: ["--accent-selected", "rgba(108, 138, 255, 0.18)"],
  accentTint: ["--accent-tint", "rgba(108, 138, 255, 0.12)"],
  onAccent: ["--on-accent", "#ffffff"],
  error: ["--error", "#ff4a6a"],
  warning: ["--warning", "#ffd43b"],
  success: ["--success", "#4aff7a"],
  info: ["--info", "#4dabf7"],
  noteTap: ["--note-tap", "#48b5ff"],
  noteDrag: ["--note-drag", "#ffd24a"],
  noteHold: ["--note-hold", "#4aff7a"],
  noteFlick: ["--note-flick", "#ff4a6a"],
  selectionColor: ["--selection-color", "#90ee90"],
  indicatorColor: ["--indicator-color", "#00e5ff"],
  onsetColor: ["--onset-color", "#ffaa32"],
  beatLinePrimary: ["--beat-line-primary", "rgba(255, 255, 255, 0.25)"],
  beatLineSecondary: ["--beat-line-secondary", "rgba(255, 255, 255, 0.10)"],
  fontSans: ["--font-sans", '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'],
  fontMono: ["--font-mono", '"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace'],
};

let cache: ChromeTheme | null = null;

function readTheme(): ChromeTheme {
  const out = {} as ChromeTheme;
  const styles =
    typeof document !== "undefined" && typeof getComputedStyle === "function"
      ? getComputedStyle(document.documentElement)
      : null;
  for (const key of Object.keys(TOKENS) as (keyof ChromeTheme)[]) {
    const [cssVar, fallback] = TOKENS[key];
    out[key] = styles?.getPropertyValue(cssVar).trim() || fallback;
  }
  return out;
}

/** Current token values (cached after the first read). */
export function chromeTheme(): ChromeTheme {
  if (!cache) cache = readTheme();
  return cache;
}

/** Drop the cache, e.g. after the stylesheet changes (HMR) — next read re-resolves. */
export function refreshChromeTheme(): void {
  cache = null;
  seriesCache = null;
}

/** Canvas font string in the UI's monospace (beats, values, time). Never below 10px for readable text. */
export function monoFont(size = 10, weight: number | "normal" | "bold" = "normal"): string {
  return `${weight} ${size}px ${chromeTheme().fontMono}`;
}

/** Canvas font string in the UI's sans face (labels). */
export function sansFont(size = 11, weight: number | "normal" | "bold" = "normal"): string {
  return `${weight} ${size}px ${chromeTheme().fontSans}`;
}

/**
 * `color` at `alpha` opacity. Accepts #rgb / #rrggbb / rgb() / rgba(); anything
 * else is returned unchanged.
 */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith("#")) {
    const hex = c.length === 4 ? c.slice(1).split("").map((ch) => ch + ch).join("") : c.slice(1, 7);
    const n = parseInt(hex, 16);
    if (Number.isNaN(n)) return color;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((p) => p.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

const SERIES_FALLBACK = ["#ff6b6b", "#4dabf7", "#69db7c", "#ffd43b", "#da77f2", "#38d9a9", "#ffa94d", "#748ffc"];
let seriesCache: string[] | null = null;

/** The `--series-1…8` palette: one colour per overlaid line or group member. */
export function seriesColors(): readonly string[] {
  if (!seriesCache) {
    const styles =
      typeof document !== "undefined" && typeof getComputedStyle === "function"
        ? getComputedStyle(document.documentElement)
        : null;
    seriesCache = SERIES_FALLBACK.map((fb, i) => styles?.getPropertyValue(`--series-${i + 1}`).trim() || fb);
  }
  return seriesCache;
}

/** Series colour for the `index`-th overlay (wraps around). */
export function seriesColor(index: number): string {
  const s = seriesColors();
  return s[index % s.length];
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", refreshChromeTheme);
}
