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
  judgmentLine: string;
  pickerRingLight: string;
  pickerRingDark: string;
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
  judgmentLine: ["--judgment-line", "#ffffff"],
  pickerRingLight: ["--picker-ring-light", "#ffffff"],
  pickerRingDark: ["--picker-ring-dark", "#000000"],
  fontSans: ["--font-sans", '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'],
  fontMono: ["--font-mono", '"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace'],
};

let cache: ChromeTheme | null = null;

/** :root computed styles, or null without a DOM (unit tests). */
function rootStyles(): CSSStyleDeclaration | null {
  return typeof document !== "undefined" && typeof getComputedStyle === "function"
    ? getComputedStyle(document.documentElement)
    : null;
}

/** A token's resolved value, or `fallback` when it isn't available. */
function tokenValue(styles: CSSStyleDeclaration | null, cssVar: string, fallback: string): string {
  return styles?.getPropertyValue(cssVar).trim() || fallback;
}

function readTheme(): ChromeTheme {
  const out = {} as ChromeTheme;
  const styles = rootStyles();
  for (const key of Object.keys(TOKENS) as (keyof ChromeTheme)[]) {
    const [cssVar, fallback] = TOKENS[key];
    out[key] = tokenValue(styles, cssVar, fallback);
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
  laneCache = null;
  markCache = null;
}

/** Canvas font string in the UI's monospace (beats, values, time). Never below 10px for readable text. */
export function monoFont(size = 10, weight: number | "normal" | "bold" = "normal"): string {
  return `${weight} ${size}px ${chromeTheme().fontMono}`;
}

/** Canvas font string in the UI's sans face (labels). */
export function sansFont(size = 11, weight: number | "normal" | "bold" = "normal"): string {
  return `${weight} ${size}px ${chromeTheme().fontSans}`;
}

/** [r, g, b] of a #rgb / #rrggbb / rgb() / rgba() colour; null for anything else. */
export function rgbOf(color: string): [number, number, number] | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    const hex = c.length === 4 ? c.slice(1).split("").map((ch) => ch + ch).join("") : c.slice(1, 7);
    const n = parseInt(hex, 16);
    return Number.isNaN(n) ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const [r, g, b] = m[1].split(",").map((p) => parseFloat(p));
  return [r, g, b].some(Number.isNaN) ? null : [r, g, b];
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
    const styles = rootStyles();
    seriesCache = SERIES_FALLBACK.map((fb, i) => tokenValue(styles, `--series-${i + 1}`, fb));
  }
  return seriesCache;
}

/** Series colour for the `index`-th overlay (wraps around). */
export function seriesColor(index: number): string {
  const s = seriesColors();
  return s[index % s.length];
}

// New groups take the series colours in this order (red, orange, yellow, green,
// teal, blue, indigo, violet) — the order groups have always used.
const GROUP_SERIES_ORDER = [0, 6, 3, 2, 5, 1, 7, 4];

/** Default colour for the `index`-th new group; stored in the group as a resolved value. */
export function groupColor(index: number): string {
  return seriesColors()[GROUP_SERIES_ORDER[index % GROUP_SERIES_ORDER.length]];
}

const EFFECT_LANE_FALLBACK: Record<string, string> = {
  chromatic: "#e06c75",
  circleBlur: "#61afef",
  fisheye: "#c678dd",
  glitch: "#e5c07b",
  grayscale: "#abb2bf",
  noise: "#d19a66",
  pixel: "#56b6c2",
  radialBlur: "#98c379",
  shockwave: "#be5046",
  vignette: "#c882e7",
};
let laneCache: Record<string, string> | null = null;

/** `--effect-<shader>` colour for a built-in shader's lane, or undefined for custom shaders. */
export function effectLaneColor(shader: string): string | undefined {
  if (!laneCache) {
    const styles = rootStyles();
    laneCache = {};
    for (const [key, fallback] of Object.entries(EFFECT_LANE_FALLBACK)) {
      laneCache[key] = tokenValue(styles, `--effect-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, fallback);
    }
  }
  return laneCache[shader];
}

const MARK_FALLBACK: Record<string, string> = {
  tap: "#48b5ff",
  drag: "#ffd24a",
  flick: "#ff4a6a",
  hold: "#2a7fbf",
  orange: "#ffa94d",
  green: "#69db7c",
  violet: "#da77f2",
};
let markCache: Record<string, string> | null = null;

/** `--mark-<preset>` colour for a tap-to-mark bookmark preset; stored in the bookmark as a resolved value. */
export function bookmarkColor(preset: string): string {
  if (!markCache) {
    const styles = rootStyles();
    markCache = {};
    for (const [key, fallback] of Object.entries(MARK_FALLBACK)) {
      markCache[key] = tokenValue(styles, `--mark-${key}`, fallback);
    }
  }
  return markCache[preset] ?? markCache.tap;
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", refreshChromeTheme);
}
