// ============================================================
// Editor Guide — Data Constants & Easing Functions
//
// Pure data definitions used by the interactive editor guide:
// note types, event types, tools, hotkeys, panels, shaders,
// presets, formats, tabs (with Lucide icons), and embedded
// easing math for animation previews.
// ============================================================

import type { LucideIcon } from "lucide-react";
import {
  MousePointer2, Eraser, Shapes, Compass, Grid2x2, Music, Spline, ChartSpline,
  Wrench, PanelsTopLeft, Keyboard, Settings2, Lightbulb,
} from "lucide-react";
import type { NoteKind } from "../../types/chart";

// ---- Note & Event Data ----
// Note and event colours are the domain identity tokens; note
// types are drawn with NoteGlyph, tools with Lucide icons.

export const NOTE_TYPES: { kind: NoteKind; label: string; shortcut: string; color: string; desc: string }[] = [
  { kind: "tap", label: "Tap", shortcut: "Q", color: "var(--note-tap)", desc: "Tap the screen when the note reaches the judgment line. The most common note type." },
  { kind: "drag", label: "Drag", shortcut: "W", color: "var(--note-drag)", desc: "Slide through — no need to lift your finger. Doesn't break combo if held." },
  { kind: "flick", label: "Flick", shortcut: "E", color: "var(--note-flick)", desc: "Swipe upward when the note reaches the line. Requires directional input." },
  { kind: "hold", label: "Hold", shortcut: "R", color: "var(--note-hold)", desc: "Hold down for a duration. Has both a head beat and a hold duration." },
];

export const EVENT_TYPES = [
  { kind: "x", color: "var(--event-x)", label: "X position", range: "-675 to +675", desc: "Horizontal position of the judgment line.", group: "core" as const },
  { kind: "y", color: "var(--event-y)", label: "Y position", range: "-450 to +450", desc: "Vertical position of the judgment line.", group: "core" as const },
  { kind: "rotation", color: "var(--event-rotation)", label: "Rotation", range: "0° to 360°+", desc: "Rotation angle in degrees. Supports multi-rotation.", group: "core" as const },
  { kind: "opacity", color: "var(--event-opacity)", label: "Opacity", range: "0 to 255", desc: "Transparency. 255 = visible, 0 = invisible.", group: "core" as const },
  { kind: "speed", color: "var(--event-speed)", label: "Speed", range: "0.0+", desc: "Note fall speed multiplier. 0 = frozen.", group: "core" as const },
  { kind: "scale_x", color: "var(--event-scale-x)", label: "Scale X", range: "0.0+", desc: "Horizontal scale of the line (RPE).", group: "rpe" as const },
  { kind: "scale_y", color: "var(--event-scale-y)", label: "Scale Y", range: "0.0+", desc: "Vertical scale of the line (RPE).", group: "rpe" as const },
  { kind: "color", color: "var(--event-color)", label: "Color", range: "RGB", desc: "RGB color tint of the judgment line (RPE).", group: "rpe" as const },
  { kind: "text", color: "var(--event-text)", label: "Text", range: "String", desc: "Text displayed on the line (RPE).", group: "rpe" as const },
  { kind: "incline", color: "var(--event-incline)", label: "Incline", range: "Float", desc: "3D tilt effect on the line (RPE).", group: "rpe" as const },
  { kind: "gif", color: "var(--event-gif)", label: "GIF", range: "0.0–1.0", desc: "Animated texture playback control (RPE).", group: "rpe" as const },
];

/** A tool is shown either as a Lucide icon or (note tools) as its NoteGlyph. */
export const TOOLS: { id: string; label: string; icon?: LucideIcon; note?: NoteKind; key: string; desc: string }[] = [
  { id: "select", label: "Select", icon: MousePointer2, key: "V", desc: "Click to select notes/events. Drag to box-select. Ctrl+click to toggle." },
  { id: "place_tap", label: "Tap", note: "tap", key: "Q", desc: "Click on the timeline or canvas to place a Tap note." },
  { id: "place_drag", label: "Drag", note: "drag", key: "W", desc: "Click to place a Drag note." },
  { id: "place_flick", label: "Flick", note: "flick", key: "E", desc: "Click to place a Flick note." },
  { id: "place_hold", label: "Hold", note: "hold", key: "R", desc: "Click to start a Hold note, click again to set the end beat." },
  { id: "eraser", label: "Eraser", icon: Eraser, key: "X", desc: "Click to delete notes or events." },
  { id: "pattern", label: "Pattern", icon: Shapes, key: "Ctrl+G", desc: "Generate note patterns from shapes (sine, zigzag, arc, etc.)." },
];

export const HOTKEYS = [
  { cat: "Tools", keys: [
    { key: "V", action: "Select tool" }, { key: "Q", action: "Place tap" }, { key: "W", action: "Place drag" },
    { key: "E", action: "Place flick" }, { key: "R", action: "Place hold" }, { key: "X", action: "Eraser tool" },
    { key: "T", action: "Toggle beat sync" }, { key: "F", action: "Flip notes above/below" },
  ]},
  { cat: "Playback", keys: [
    { key: "Space", action: "Play / pause" }, { key: "Left / Right", action: "Seek backward / forward" },
  ]},
  { cat: "File", keys: [
    { key: "Ctrl+N", action: "New chart…" }, { key: "Ctrl+O", action: "Import chart…" },
    { key: "Ctrl+S", action: "Save project" }, { key: "Ctrl+K", action: "Command palette" },
  ]},
  { cat: "Editing", keys: [
    { key: "Ctrl+Z", action: "Undo" }, { key: "Ctrl+Shift+Z", action: "Redo" },
    { key: "Ctrl+A", action: "Select all notes" }, { key: "Delete", action: "Delete selected" },
    { key: "Ctrl+C / X / V", action: "Copy / Cut / Paste" },
    { key: "Up / Down", action: "Move notes in time" }, { key: "Left / Right", action: "Move notes left/right" },
  ]},
  { cat: "Panels", keys: [
    { key: "L", action: "Line drawer" }, { key: "I", action: "Inspector" },
    { key: "K", action: "Keyframe bar" }, { key: "Shift+K", action: "Curve editor" },
    { key: "Alt+1 / 2 / 3", action: "Timeline / Lines / Effects" },
    { key: "Shift+F", action: "Fit all (reset zoom)" }, { key: "Ctrl+L", action: "LineStrip search" },
  ]},
  { cat: "Groups", keys: [
    { key: "Ctrl+G", action: "Toggle pattern tool" }, { key: "Ctrl+Shift+G", action: "Create group" },
    { key: "G", action: "Enter group edit" }, { key: "Escape", action: "Exit group edit" },
  ]},
  { cat: "Modes", keys: [
    { key: "Shift+I", action: "Toggle mark/improv mode" }, { key: "Alt+R", action: "Toggle record mode" },
    { key: "1 / 2 / 3", action: "Place colored bookmarks (in Mark mode)" },
  ]},
];

export const PANELS = [
  { id: "Inspector", tier: "always" as const, desc: "Properties of selected notes, events, or lines." },
  { id: "Toolbar", tier: "always" as const, desc: "Note placement tools and eraser." },
  { id: "Timeline", tier: "quick" as const, desc: "Vertical beat grid — the main editing surface." },
  { id: "Lines", tier: "quick" as const, desc: "List of all judgment lines in the chart." },
  { id: "Effects", tier: "quick" as const, desc: "Shader post-processing effects editor." },
  { id: "Textures", tier: "on_demand" as const, desc: "Custom line textures and resource packs." },
  { id: "Groups", tier: "on_demand" as const, desc: "Create and manage line and note groups." },
  { id: "BPM list", tier: "on_demand" as const, desc: "Manage tempo change points." },
  { id: "Chart settings", tier: "on_demand" as const, desc: "Song name, composer, offset metadata." },
  { id: "Validation", tier: "on_demand" as const, desc: "Scan chart for errors and warnings." },
  { id: "Presets", tier: "on_demand" as const, desc: "Built-in and custom event presets." },
];

export const SHADERS = [
  { name: "chromatic", desc: "RGB channel split" }, { name: "circleBlur", desc: "Circular dot blur" },
  { name: "fisheye", desc: "Lens distortion" }, { name: "glitch", desc: "Digital glitch effect" },
  { name: "grayscale", desc: "Grayscale conversion" }, { name: "noise", desc: "Noise/grain overlay" },
  { name: "pixel", desc: "Pixelation" }, { name: "radialBlur", desc: "Zoom blur from center" },
  { name: "shockwave", desc: "Expanding ripple" }, { name: "vignette", desc: "Darkened edges" },
];

export const PRESETS = [
  { cat: "Movement", items: ["Slide in from left", "Slide in from right", "Bounce Y", "Off-screen fling"] },
  { cat: "Visibility", items: ["Fade in", "Fade out", "Strobe flash"] },
  { cat: "Rotation", items: ["Gentle sway", "Full spin (360°)"] },
  { cat: "Speed", items: ["Speed freeze", "Speed burst", "Freeze + unfreeze", "Slow motion"] },
  { cat: "Compound", items: ["Dual spin", "Ghost sweep", "Off-screen + spin return"] },
];

export const FORMATS = [
  { name: "PhiChain (.json)", desc: "Native format — stores everything.", dir: "Read/Write" },
  { name: "RPE (.json/.pez)", desc: "Re:PhiEdit — industry standard for custom charts.", dir: "Import/Export" },
  { name: "PEC (.json)", desc: "Phigros Extended Chart — older format.", dir: "Import/Export" },
  { name: "Official (.json)", desc: "Original Phigros official format.", dir: "Import/Export" },
  { name: ".pez (ZIP)", desc: "Phira archive — bundles chart + audio + assets.", dir: "Export" },
];

export const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "welcome", label: "Welcome", icon: Compass },
  { id: "canvas", label: "The canvas", icon: Grid2x2 },
  { id: "notes", label: "Notes", icon: Music },
  { id: "events", label: "Events", icon: Spline },
  { id: "easings", label: "Easings", icon: ChartSpline },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "panels", label: "Panels", icon: PanelsTopLeft },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "advanced", label: "Advanced", icon: Settings2 },
  { id: "tips", label: "Tips", icon: Lightbulb },
];

// ---- Easing Functions (embedded for animation previews) ----

const PI = Math.PI;
const c1 = 1.70158; const c2 = c1 * 1.525; const c3 = c1 + 1;
const c4 = (2 * PI) / 3; const c5 = (2 * PI) / 4.5;

export const easingFns: Record<string, (t: number) => number> = {
  linear: t => t,
  ease_in_sine: t => 1 - Math.cos((t * PI) / 2),
  ease_out_sine: t => Math.sin((t * PI) / 2),
  ease_in_out_sine: t => -(Math.cos(PI * t) - 1) / 2,
  ease_in_quad: t => t * t,
  ease_out_quad: t => 1 - (1 - t) * (1 - t),
  ease_in_out_quad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  ease_in_cubic: t => t * t * t,
  ease_out_cubic: t => 1 - Math.pow(1 - t, 3),
  ease_in_out_cubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  ease_in_quart: t => t * t * t * t,
  ease_out_quart: t => 1 - Math.pow(1 - t, 4),
  ease_in_out_quart: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  ease_in_quint: t => t * t * t * t * t,
  ease_out_quint: t => 1 - Math.pow(1 - t, 5),
  ease_in_out_quint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  ease_in_expo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  ease_out_expo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  ease_in_out_expo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  ease_in_circ: t => 1 - Math.sqrt(1 - t * t),
  ease_out_circ: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
  ease_in_out_circ: t => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  ease_in_back: t => c3 * t * t * t - c1 * t * t,
  ease_out_back: t => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  ease_in_out_back: t => t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,
  ease_in_elastic: t => t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4),
  ease_out_elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  ease_in_out_elastic: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2 : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1,
  ease_out_bounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  ease_in_bounce: t => 1 - easingFns.ease_out_bounce(1 - t),
  ease_in_out_bounce: t => t < 0.5 ? (1 - easingFns.ease_out_bounce(1 - 2 * t)) / 2 : (1 + easingFns.ease_out_bounce(2 * t - 1)) / 2,
};

export const EASING_NAMES = Object.keys(easingFns);

export const EASING_FAMILIES = [
  { name: "Linear", easings: ["linear"] },
  { name: "Sine", easings: ["ease_in_sine", "ease_out_sine", "ease_in_out_sine"] },
  { name: "Quad", easings: ["ease_in_quad", "ease_out_quad", "ease_in_out_quad"] },
  { name: "Cubic", easings: ["ease_in_cubic", "ease_out_cubic", "ease_in_out_cubic"] },
  { name: "Quart", easings: ["ease_in_quart", "ease_out_quart", "ease_in_out_quart"] },
  { name: "Quint", easings: ["ease_in_quint", "ease_out_quint", "ease_in_out_quint"] },
  { name: "Expo", easings: ["ease_in_expo", "ease_out_expo", "ease_in_out_expo"] },
  { name: "Circ", easings: ["ease_in_circ", "ease_out_circ", "ease_in_out_circ"] },
  { name: "Back", easings: ["ease_in_back", "ease_out_back", "ease_in_out_back"] },
  { name: "Elastic", easings: ["ease_in_elastic", "ease_out_elastic", "ease_in_out_elastic"] },
  { name: "Bounce", easings: ["ease_in_bounce", "ease_out_bounce", "ease_in_out_bounce"] },
];
