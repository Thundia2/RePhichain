// ============================================================
// Bookmark Types
//
// Bookmarks are points of interest placed during improv mode.
// They mark positions on a judgment line at a specific beat,
// serving as visual reference markers for chart editing.
// Bookmarks are editor-only data — they don't affect gameplay.
// They persist via Canvas/bookmarks.json in .pez exports.
// ============================================================

import type { Beat } from "./chart";

/** A bookmark placed on the canvas during improv mode */
export interface Bookmark {
  /** Unique bookmark ID */
  id: string;
  /** Beat position in the chart */
  beat: Beat;
  /** X position on the judgment line (-675 to +675) */
  x: number;
  /** Whether the bookmark is above or below the line */
  above: boolean;
  /** Line index this bookmark belongs to */
  lineIndex: number;
  /** Optional user label */
  label?: string;
  /** Color for display (hex string) */
  color: string;
  /** Which preset was used (for display and note conversion) */
  preset?: BookmarkPreset;
}

/**
 * Tap-to-mark presets (Q W E R for the note kinds, 1–3 misc). Their colours
 * are the --mark-* design tokens, resolved by bookmarkColor() in
 * canvas/chromeTheme.ts and stored in each bookmark.
 */
export const BOOKMARK_PRESET_KEYS = ["tap", "drag", "flick", "hold", "orange", "green", "violet"] as const;

export type BookmarkPreset = (typeof BOOKMARK_PRESET_KEYS)[number];
