// ============================================================
// Editor Guide — Animation Components
//
// Interactive SVG animations that demonstrate editor concepts:
// coordinate system, note falling, event transitions, easing
// curves. Each animation is self-contained and driven by
// useAnimationLoop from guideComponents. Notes and events keep
// their identity colours; frames, guides and labels use tokens.
// ============================================================

import { useRef, useEffect, useState } from "react";
import { useAnimationLoop, EasingMini } from "./guideComponents";
import { SegmentedControl } from "../common/SegmentedControl";
import { Pill } from "../common/UIKit";
import { NOTE_TYPES, easingFns, EASING_NAMES, EASING_FAMILIES } from "./guideData";

const PI = Math.PI;

/** Monospace SVG text (values, coordinates). */
const MONO = { fontFamily: "var(--font-mono)" } as const;

// ---- Coordinate System (Canvas tab) ----

export function CanvasCoordAnimation({ active }: { active: boolean }) {
  const svgRef = useRef<SVGGElement>(null);
  const labelXRef = useRef<SVGTextElement>(null);
  const labelYRef = useRef<SVGTextElement>(null);
  const trailRef = useRef<SVGGElement>(null);
  const timeRef = useAnimationLoop(active);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 6) / 6;
      const x = Math.sin(2 * PI * t) * 80;
      const y = Math.sin(4 * PI * t) * 50;
      const cx = 150 + x, cy = 100 + y;

      if (svgRef.current) svgRef.current.setAttribute("transform", `translate(${cx}, ${cy})`);
      if (labelXRef.current) labelXRef.current.textContent = `X: ${Math.round(x / 80 * 675)}`;
      if (labelYRef.current) labelYRef.current.textContent = `Y: ${Math.round(-y / 50 * 450)}`;

      if (trailRef.current) {
        const children = trailRef.current.children;
        for (let i = 0; i < 4; i++) {
          const tt = ((timeRef.current - (i + 1) * 0.12) % 6) / 6;
          const tx = 150 + Math.sin(2 * PI * tt) * 80;
          const ty = 100 + Math.sin(4 * PI * tt) * 50;
          if (children[i]) {
            children[i].setAttribute("cx", String(tx));
            children[i].setAttribute("cy", String(ty));
          }
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, timeRef]);

  return (
    <svg width="100%" height="200" viewBox="0 0 300 200" style={{ display: "block", margin: "0 auto" }}>
      <rect x="30" y="10" width="240" height="180" fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth="1" rx="4" />
      <line x1="150" y1="10" x2="150" y2="190" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,3" />
      <line x1="30" y1="100" x2="270" y2="100" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,3" />
      <text x="150" y="8" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" style={MONO}>+450</text>
      <text x="150" y="199" textAnchor="middle" fill="var(--text-secondary)" fontSize="10" style={MONO}>-450</text>
      <text x="274" y="103" textAnchor="start" fill="var(--text-secondary)" fontSize="10" style={MONO}>+675</text>
      <text x="26" y="103" textAnchor="end" fill="var(--text-secondary)" fontSize="10" style={MONO}>-675</text>
      <text x="158" y="95" fill="var(--text-secondary)" fontSize="10" style={MONO}>(0, 0)</text>
      <g ref={trailRef}>
        {[0.15, 0.1, 0.06, 0.03].map((op, i) => (
          <circle key={i} cx="150" cy="100" r="3" fill="var(--accent-primary)" opacity={op} />
        ))}
      </g>
      <g ref={svgRef}>
        <line x1="-25" y1="0" x2="25" y2="0" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="0" cy="0" r="2.5" fill="var(--accent-primary)" />
      </g>
      <rect x="95" y="171" width="110" height="18" rx="4" fill="var(--bg-active)" opacity="0.85" />
      <text ref={labelXRef} x="125" y="184" textAnchor="middle" fill="var(--event-x)" fontSize="10" style={MONO}>X: 0</text>
      <text ref={labelYRef} x="175" y="184" textAnchor="middle" fill="var(--event-y)" fontSize="10" style={MONO}>Y: 0</text>
    </svg>
  );
}

// ---- Above / Below (Canvas tab) ----

export function AboveBelowAnimation({ active }: { active: boolean }) {
  const aboveRef = useRef<SVGRectElement>(null);
  const belowRef = useRef<SVGRectElement>(null);
  const flashRef = useRef<SVGCircleElement>(null);
  const timeRef = useAnimationLoop(active);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 3) / 3;
      const progress = Math.min(t / 0.7, 1);
      const lineY = 60;
      const aboveY = lineY - 45 + progress * 45;
      const belowY = lineY + 45 - progress * 45;

      if (aboveRef.current) aboveRef.current.setAttribute("y", String(aboveY - 4));
      if (belowRef.current) belowRef.current.setAttribute("y", String(belowY - 4));

      if (flashRef.current) {
        const hitPhase = t > 0.7 ? (t - 0.7) / 0.15 : 0;
        const flashOpacity = hitPhase > 0 && hitPhase < 1 ? 1 - hitPhase : 0;
        const flashR = 3 + hitPhase * 12;
        flashRef.current.setAttribute("r", String(flashR));
        flashRef.current.setAttribute("opacity", String(flashOpacity));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, timeRef]);

  return (
    <svg width="100%" height="120" viewBox="0 0 240 120" style={{ display: "block" }}>
      <line x1="50" y1="60" x2="190" y2="60" stroke="var(--accent-primary)" strokeWidth="2" />
      <rect ref={aboveRef} x="95" y="15" width="20" height="8" rx="2" fill="var(--note-tap)" />
      <text x="90" y="21" textAnchor="end" fill="var(--text-secondary)" fontSize="10">Above</text>
      <rect ref={belowRef} x="125" y="105" width="20" height="8" rx="2" fill="var(--note-tap)" />
      <text x="152" y="113" fill="var(--text-secondary)" fontSize="10">Below</text>
      <circle ref={flashRef} cx="120" cy="60" r="3" fill="white" opacity="0" />
    </svg>
  );
}

// ---- Note Falling (Notes tab) ----

export function NoteFallingAnimation({ active }: { active: boolean }) {
  const noteRefs = useRef<(SVGGElement | null)[]>([]);
  const flashRefs = useRef<(SVGCircleElement | null)[]>([]);
  const holdBarRef = useRef<SVGRectElement>(null);
  const timeRef = useAnimationLoop(active);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 3) / 3;
      const startY = 10, lineY = 130;
      const progress = Math.min(t / 0.75, 1);
      const y = startY + progress * (lineY - startY);

      for (let i = 0; i < 4; i++) {
        const el = noteRefs.current[i];
        if (el) el.setAttribute("transform", `translate(0, ${y})`);

        const fl = flashRefs.current[i];
        if (fl) {
          const hitPhase = t > 0.75 ? (t - 0.75) / 0.12 : 0;
          const op = hitPhase > 0 && hitPhase < 1 ? 1 - hitPhase : 0;
          fl.setAttribute("r", String(3 + hitPhase * 10));
          fl.setAttribute("opacity", String(op));
        }
      }
      if (holdBarRef.current) {
        const holdH = Math.max(0, progress * 40);
        holdBarRef.current.setAttribute("height", String(holdH));
        holdBarRef.current.setAttribute("y", String(y - holdH));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, timeRef]);

  const laneW = 55, lineY = 130;
  return (
    <svg width="100%" height="160" viewBox="0 0 240 160" style={{ display: "block", margin: "0 auto" }}>
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={10 + i * laneW} y1="0" x2={10 + i * laneW} y2="160" stroke="var(--border-color)" strokeWidth="0.5" />
      ))}
      {NOTE_TYPES.map((n, i) => (
        <g key={n.kind}>
          <line x1={10 + i * laneW + 4} y1={lineY} x2={10 + (i + 1) * laneW - 4} y2={lineY} stroke={n.color} strokeWidth="2" opacity="0.5" />
          <text x={10 + i * laneW + laneW / 2} y="155" textAnchor="middle" fill={n.color} fontSize="10" fontWeight="600">{n.label}</text>
          <circle ref={el => { flashRefs.current[i] = el; }} cx={10 + i * laneW + laneW / 2} cy={lineY} r="3" fill="white" opacity="0" />
        </g>
      ))}
      <rect ref={holdBarRef} x={10 + 3 * laneW + laneW / 2 - 5} y={lineY} width="10" height="0" rx="2" fill="var(--note-hold)" opacity="0.4" />
      {NOTE_TYPES.map((n, i) => (
        <g key={n.kind} ref={el => { noteRefs.current[i] = el; }}>
          {n.kind === "tap" && <circle cx={10 + i * laneW + laneW / 2} cy={0} r="6" fill={n.color} />}
          {n.kind === "drag" && <rect x={10 + i * laneW + laneW / 2 - 6} y={-4} width="12" height="8" rx="2" fill={n.color} />}
          {n.kind === "flick" && <polygon points={`${10 + i * laneW + laneW / 2},${-6} ${10 + i * laneW + laneW / 2 - 7},${5} ${10 + i * laneW + laneW / 2 + 7},${5}`} fill={n.color} />}
          {n.kind === "hold" && <rect x={10 + i * laneW + laneW / 2 - 6} y={-4} width="12" height="8" rx="2" fill={n.color} />}
        </g>
      ))}
    </svg>
  );
}

// ---- Event Transition Demo (Events tab) ----

export function EventTransitionAnimation({ active }: { active: boolean }) {
  const lineRef = useRef<SVGGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const [channel, setChannel] = useState<"x" | "y" | "rotation">("x");
  const timeRef = useAnimationLoop(active);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 3) / 3;
      const eased = easingFns.ease_in_out_cubic(t);
      let cx = 150, cy = 80, rot = 0;
      if (channel === "x") { cx = 60 + eased * 180; }
      else if (channel === "y") { cy = 30 + eased * 100; }
      else { rot = eased * 180; }

      if (lineRef.current) lineRef.current.setAttribute("transform", `translate(${cx}, ${cy}) rotate(${rot})`);
      if (dotRef.current) {
        dotRef.current.setAttribute("cx", String(20 + t * 260));
        dotRef.current.setAttribute("cy", String(140 - eased * 20));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, channel, timeRef]);

  const channels = [
    { id: "x" as const, color: "var(--event-x)", label: "X" },
    { id: "y" as const, color: "var(--event-y)", label: "Y" },
    { id: "rotation" as const, color: "var(--event-rotation)", label: "Rotation" },
  ];

  return (
    <div>
      <div style={{ display: "flex", marginBottom: "var(--space-6)", justifyContent: "center" }}>
        <SegmentedControl
          label="Event channel"
          size="sm"
          value={channel}
          onChange={setChannel}
          options={channels.map(ch => ({ value: ch.id, label: ch.label }))}
        />
      </div>
      <svg width="100%" height="160" viewBox="0 0 300 160" style={{ display: "block", margin: "0 auto" }}>
        <rect x="10" y="10" width="280" height="120" fill="var(--bg-primary)" stroke="var(--border-color)" rx="4" />
        <g ref={lineRef}>
          <line x1="-30" y1="0" x2="30" y2="0" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2.5" fill="var(--accent-primary)" />
        </g>
        <line x1="20" y1="140" x2="280" y2="140" stroke="var(--border-color)" strokeWidth="0.5" />
        <circle ref={dotRef} cx="20" cy="140" r="3" fill={channels.find(c => c.id === channel)?.color ?? "var(--accent-primary)"} />
      </svg>
    </div>
  );
}

// ---- Constant vs Transition (Events tab) ----

export function ConstantVsTransition({ active }: { active: boolean }) {
  const constLineRef = useRef<SVGLineElement>(null);
  const transLineRef = useRef<SVGGElement>(null);
  const timeRef = useAnimationLoop(active);

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 2.5) / 2.5;
      const constX = t < 0.5 ? 40 : 100;
      if (constLineRef.current) constLineRef.current.setAttribute("x1", String(constX - 18));
      if (constLineRef.current) constLineRef.current.setAttribute("x2", String(constX + 18));

      const transT = Math.min(t / 0.8, 1);
      const eased = easingFns.ease_in_out_cubic(transT);
      const transX = 40 + eased * 60;
      if (transLineRef.current) transLineRef.current.setAttribute("transform", `translate(${transX}, 40)`);

      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, timeRef]);

  return (
    <div style={{ display: "flex", gap: "var(--space-8)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", textAlign: "center", marginBottom: "var(--space-4)", fontWeight: 600 }}>Constant</div>
        <svg width="100%" height="80" viewBox="0 0 140 80" style={{ display: "block" }}>
          <rect x="5" y="5" width="130" height="70" fill="var(--bg-primary)" stroke="var(--border-color)" rx="4" />
          <line ref={constLineRef} x1="22" y1="40" x2="58" y2="40" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <text x="70" y="69" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">Snaps instantly</text>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", textAlign: "center", marginBottom: "var(--space-4)", fontWeight: 600 }}>Transition</div>
        <svg width="100%" height="80" viewBox="0 0 140 80" style={{ display: "block" }}>
          <rect x="5" y="5" width="130" height="70" fill="var(--bg-primary)" stroke="var(--border-color)" rx="4" />
          <g ref={transLineRef}>
            <line x1="-18" y1="0" x2="18" y2="0" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="0" cy="0" r="2" fill="var(--accent-primary)" />
          </g>
          <text x="70" y="69" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">Slides smoothly</text>
        </svg>
      </div>
    </div>
  );
}

// ---- Easing Curve Explorer (Easings tab) ----

export function EasingExplorer({ active }: { active: boolean }) {
  const [selected, setSelected] = useState("ease_out_cubic");
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<SVGRectElement>(null);
  const timeRef = useAnimationLoop(active);

  const filteredEasings = familyFilter
    ? EASING_FAMILIES.find(f => f.name === familyFilter)?.easings ?? EASING_NAMES
    : EASING_NAMES;

  useEffect(() => {
    if (!active) return;
    let id = 0;
    const tick = () => {
      const t = (timeRef.current % 2) / 2;
      const fn = easingFns[selected] ?? easingFns.linear;
      const v = fn(t);

      const pad = 20, gw = 200, gh = 140;
      const dx = pad + t * gw;
      const dy = pad + gh - v * gh;
      if (dotRef.current) {
        dotRef.current.setAttribute("cx", String(dx));
        dotRef.current.setAttribute("cy", String(Math.max(pad - 15, Math.min(pad + gh + 15, dy))));
      }
      const barH = Math.max(0, Math.min(gh, v * gh));
      if (barRef.current) {
        barRef.current.setAttribute("y", String(pad + gh - barH));
        barRef.current.setAttribute("height", String(barH));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [active, selected, timeRef]);

  const fn = easingFns[selected] ?? easingFns.linear;
  const pad = 20, gw = 200, gh = 140;
  const pts: string[] = [];
  for (let i = 0; i <= 50; i++) {
    const t = i / 50;
    const v = fn(t);
    pts.push(`${pad + t * gw},${pad + gh - v * gh}`);
  }

  return (
    <div>
      {/* Family filter row */}
      <div role="group" aria-label="Easing family" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-8)" }}>
        <Pill active={!familyFilter} onClick={() => setFamilyFilter(null)}>All</Pill>
        {EASING_FAMILIES.map(f => (
          <Pill key={f.name} active={familyFilter === f.name} onClick={() => setFamilyFilter(f.name === familyFilter ? null : f.name)}>
            {f.name}
          </Pill>
        ))}
      </div>

      {/* Main explorer */}
      <div style={{ display: "flex", gap: "var(--space-10)" }}>
        <svg width="240" height="180" viewBox="0 0 240 180" style={{ flexShrink: 0 }}>
          <rect x={pad} y={pad} width={gw} height={gh} fill="var(--bg-primary)" stroke="var(--border-color)" rx="3" />
          <line x1={pad} y1={pad + gh} x2={pad + gw} y2={pad} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="2,2" />
          <polyline points={pts.join(" ")} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinejoin="round" />
          <circle ref={dotRef} cx={pad} cy={pad + gh} r="4" fill="var(--accent-primary)" />
          <rect ref={barRef} x={pad + gw + 8} y={pad + gh} width="8" height="0" rx="2" fill="var(--accent-primary)" opacity="0.6" />
          <rect x={pad + gw + 8} y={pad} width="8" height={gh} rx="2" fill="none" stroke="var(--border-color)" strokeWidth="0.5" />
          <text x={pad + gw / 2} y={pad + gh + 16} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" style={MONO}>{selected}</text>
        </svg>

        <div style={{ flex: 1, padding: "4px 0" }}>
          <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)", marginBottom: "var(--space-4)" }}>{selected}</div>
          <div style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {selected.includes("in_out") ? "Slow start and slow end — smooth both ways." :
             selected.includes("_in_") || selected.startsWith("ease_in") ? "Slow start, fast end — builds momentum." :
             selected.includes("_out_") || selected.startsWith("ease_out") ? "Fast start, slow end — decelerates." :
             "Constant speed, no acceleration."}
            {selected.includes("back") && " Overshoots the target, then returns."}
            {selected.includes("elastic") && " Spring-like oscillation around the target."}
            {selected.includes("bounce") && " Bounces off the target value."}
          </div>
          <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-8)" }}>
            Tip: <strong>In</strong> = slow start, <strong>Out</strong> = slow end, <strong>InOut</strong> = slow both
          </div>
        </div>
      </div>

      {/* Grid of all easings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "var(--space-4)", marginTop: "var(--space-10)", maxHeight: 200, overflowY: "auto" }}>
        {filteredEasings.map(name => {
          const isSel = selected === name;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={isSel}
              className={isSel ? undefined : "ui-hover"}
              onClick={() => setSelected(name)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "var(--space-4)", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", textAlign: "center",
                // Unselected cells take their hover wash from .ui-hover (no inline background).
                background: isSel ? "var(--accent-selected)" : undefined,
                color: isSel ? "var(--accent-primary)" : "var(--text-secondary)",
                fontFamily: "inherit",
              }}
            >
              <EasingMini name={name} size={48} />
              <div style={{ fontSize: "var(--fs-caption)", marginTop: 1, fontFamily: "var(--font-mono)", wordBreak: "break-all", lineHeight: 1.2 }}>
                {name.replace(/ease_/g, "").replace(/_/g, " ")}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
