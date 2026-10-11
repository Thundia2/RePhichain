// ============================================================
// Height of the docked keyframe bar: the strip itself plus, while
// the curve editor is expanded inline, its resize handle and graph.
// Without the extra room the fixed-height dock clipped the graph to
// a sliver (CurveGraph draws at curveEditorHeight).
// ============================================================

import { useEditorStore } from "../../stores/editorStore";

/** Matches CurveEditorResizeHandle in KeyframeBar.tsx. */
const CURVE_HANDLE_HEIGHT = 4;

export function useKeyframeDockHeight(): number {
  const open = useEditorStore((s) => s.keyframeBarOpen);
  const barHeight = useEditorStore((s) => s.keyframeBarHeight);
  const curveExpanded = useEditorStore((s) => s.curveEditorExpanded);
  const curvePoppedOut = useEditorStore((s) => s.curveEditorPoppedOut);
  const curveHeight = useEditorStore((s) => s.curveEditorHeight);

  if (!open) return 0;
  return curveExpanded && !curvePoppedOut ? barHeight + CURVE_HANDLE_HEIGHT + curveHeight : barHeight;
}
