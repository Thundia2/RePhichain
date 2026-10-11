// ============================================================
// Editor Guide — animation loop hook used by the guide demos.
// ============================================================

import type React from "react";
import { useRef, useEffect } from "react";

/** Returns a ref containing elapsed seconds, driven by requestAnimationFrame */
export function useAnimationLoop(active: boolean): React.MutableRefObject<number> {
  const progressRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      progressRef.current = elapsed / 1000;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return progressRef;
}
