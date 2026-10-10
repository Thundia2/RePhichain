// ============================================================
// Editor Guide — Shared UI Components & Animation Hook
//
// Small reusable atoms and the animation loop hook used by
// both the animation demos and the tab content components.
// ============================================================

import React, { useRef, useEffect } from "react";
import { easingFns } from "./guideData";

// ---- Animation Hook ----

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

// ---- Shared Atoms ----

/** Filled content card (bg-active, radius-lg). No frame, no accent edge. */
export function GCard({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--bg-active)",
      borderRadius: "var(--radius-lg)", padding: "var(--space-10) var(--space-12)", ...s,
    }}>{children}</div>
  );
}

/** Sentence-case section heading inside a guide tab. */
export function STitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: "var(--fs-headline)", lineHeight: "18px", fontWeight: 600,
      color: "var(--text-primary)", margin: "var(--space-20) 0 var(--space-8)",
    }}>{children}</h3>
  );
}

/** Small identity-colour dot (event / note colour). */
export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: "var(--radius-full)", background: color, flexShrink: 0 }} />;
}

/** Small SVG easing curve thumbnail */
export function EasingMini({ name, size = 52 }: { name: string; size?: number }) {
  const fn = easingFns[name];
  if (!fn) return null;
  const pad = 5, w = size - pad * 2;
  const pts: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const v = fn(t);
    pts.push(`${pad + t * w},${size - pad - v * w}`);
  }
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ display: "block" }}>
      <rect x={pad} y={pad} width={w} height={w} fill="none" stroke="var(--border-color)" strokeWidth="0.5" rx="2" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
