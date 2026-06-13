// ============================================================
// Recording commit — convert recorded keyframes → line events (finding D1, critical)
//
// Record mode (editorStore.recordMode) captures the SELECTED line's transform as
// the user drags it during playback, appending { beat, x?, y? } samples to
// editorStore.recordedKeyframes (capture site: UnifiedCanvas.tsx ~:986 →
// captureRecordKeyframe in CanvasMouseHandlers.ts; values are ABSOLUTE canvas
// coords). RecordReviewDialog then asks the user to accept (raw or simplified).
//
// Before D1 the accept path was a no-op: App.tsx wired `onAccept={() =>
// closeDialog(...)}`, so the keyframes were NEVER converted to events and never
// cleared — every recording was silently discarded. This module performs the
// actual conversion + commit and is what App's onAccept now calls.
//
// Design notes:
//  - Per-channel: x / y / rotation are committed as INDEPENDENT event series. The
//    dialog's SimplifiableKeyframe projection collapses all channels to one value
//    (kf.x ?? kf.y ?? kf.rotation), so committing from THAT would drop y/rotation.
//    We read the raw recordedKeyframes here and split by channel instead. (rotation
//    is currently never captured — captureRecordKeyframe only sets x/y — but is
//    handled generically so a future rotation wire-up needs no change here.)
//  - Routing: events are written via chartStore.addEventRouted, NOT
//    batchMultiLineMutations. On a layered (RPE-imported) chart the evaluator reads
//    core kinds from event_layers and IGNORES flat core-kind events (finding L3);
//    batchMultiLineMutations writes flat-only, so the recording would be invisible.
//    addEventRouted(line, evt) auto-routes to layer 0 on layered charts, flat
//    otherwise (utils/eventRouting.routeEventTarget).
//  - Atomicity: the whole commit runs inside chartStore.transaction so it is a
//    single Ctrl+Z entry (finding L1).
//
// grep commitRecordedKeyframes / recordedKeyframesToEvents.
// ============================================================

import type { Beat, LineEvent, LineEventKind } from "../types/chart";
import { floatToBeat, beatToFloat } from "../types/chart";
import { simplifyKeyframes } from "./keyframeSimplify";
import { useChartStore } from "../stores/chartStore";
import { useEditorStore } from "../stores/editorStore";
import { getSelectedLineIndex } from "../stores/selection";

/** One captured record-mode sample. Mirrors editorStore.recordedKeyframes. */
export interface RecordedKeyframe {
  beat: number;
  x?: number;
  y?: number;
  rotation?: number;
}

// The recordable channels, mapped to the LineEvent kind each produces.
const RECORD_CHANNELS: ReadonlyArray<{ key: "x" | "y" | "rotation"; kind: LineEventKind }> = [
  { key: "x", kind: "x" },
  { key: "y", kind: "y" },
  { key: "rotation", kind: "rotation" },
];

/**
 * Convert recorded keyframes into line events — one independent linear-transition
 * series per channel that carries data. Pure (no store access) so it is
 * unit-testable under the node test env.
 *
 * @param keyframes recorded samples in capture (chronological) order
 * @param simplifyThreshold Ramer-Douglas-Peucker epsilon; null = keep all (raw)
 * @returns flat LineEvent[] across all channels. Events carry no `id` — the store
 *          write (addEventRouted) assigns one on insertion.
 */
export function recordedKeyframesToEvents(
  keyframes: RecordedKeyframe[],
  simplifyThreshold: number | null,
): LineEvent[] {
  const out: LineEvent[] = [];

  for (const { key, kind } of RECORD_CHANNELS) {
    // This channel's (beat, value) samples. A keyframe is included only when it
    // actually carries the field, so `value: 0` is kept (0 !== undefined) — the
    // falsy-zero clobber the rest of this remediation keeps killing.
    let pts = keyframes
      .filter((kf) => kf[key] !== undefined)
      .map((kf) => ({ beat: kf.beat, value: kf[key] as number }));
    if (pts.length === 0) continue;

    // Capture order is chronological, but sort defensively — simplify and segment
    // building both assume ascending beats.
    pts.sort((a, b) => a.beat - b.beat);

    if (simplifyThreshold !== null && simplifyThreshold > 0) {
      pts = simplifyKeyframes(pts, simplifyThreshold);
    }

    // Quantize to the chart's rational-beat grid and collapse samples that round to
    // the same beat tuple (keep the latest value) so we never emit a zero-length
    // [b,b] transition. captureRecordKeyframe only dedups beats > 0.01 apart, but
    // two such floats can still round to the same 1/32 tuple.
    const quantized: Array<{ beat: Beat; value: number }> = [];
    for (const p of pts) {
      const b = floatToBeat(p.beat);
      const last = quantized[quantized.length - 1];
      if (last && beatToFloat(last.beat) === beatToFloat(b)) {
        last.value = p.value;
      } else {
        quantized.push({ beat: b, value: p.value });
      }
    }

    if (quantized.length === 1) {
      // A lone sample → a constant event pinning the value at that beat.
      out.push({
        kind,
        start_beat: quantized[0].beat,
        end_beat: quantized[0].beat,
        value: { constant: quantized[0].value },
      });
      continue;
    }

    // Piecewise-linear reconstruction: each consecutive pair is a linear transition
    // segment. The evaluator holds the last value after the final sample, so no
    // trailing event is needed.
    for (let i = 0; i < quantized.length - 1; i++) {
      out.push({
        kind,
        start_beat: quantized[i].beat,
        end_beat: quantized[i + 1].beat,
        value: {
          transition: {
            start: quantized[i].value,
            end: quantized[i + 1].value,
            easing: "linear",
          },
        },
      });
    }
  }

  return out;
}

/** Outcome of a commit, for the caller's toast. */
export type CommitResult =
  | { ok: true; committed: number; lineIndex: number }
  | { ok: false; reason: "no-line" | "no-keyframes" };

/**
 * Commit the current recordedKeyframes to the selected line as events, then clear
 * the recording. Returns a result for the caller to surface.
 *
 * Target = the currently selected line. Recording only runs for the selected line
 * (UnifiedCanvas.tsx:989) and the review dialog is modal, so the selection can't
 * have changed since capture.
 */
export function commitRecordedKeyframes(simplifyThreshold: number | null): CommitResult {
  const es = useEditorStore.getState();
  const keyframes = es.recordedKeyframes;
  if (keyframes.length === 0) return { ok: false, reason: "no-keyframes" };

  const lineIndex = getSelectedLineIndex();
  if (lineIndex === null) {
    // Leave the buffer intact so the recording isn't lost on a (near-impossible)
    // no-selection accept; the caller reports the error.
    return { ok: false, reason: "no-line" };
  }

  const events = recordedKeyframesToEvents(keyframes, simplifyThreshold);

  if (events.length > 0) {
    const cs = useChartStore.getState();
    cs.transaction(() => {
      for (const event of events) {
        cs.addEventRouted(lineIndex, event);
      }
    });
  }

  // Clear regardless (also turns record mode off) so the dialog never strands a
  // committed-or-empty buffer.
  es.clearRecordedKeyframes();
  return { ok: true, committed: events.length, lineIndex };
}
