// ============================================================
// Editor Guide — Tab Content Components
//
// One component per guide tab. Each renders the content for
// its section of the interactive editor guide.
// ============================================================

import type React from "react";
import { Minus, Spline } from "lucide-react";
import { GCard, STitle, ColorDot } from "./guideComponents";
import { Kbd } from "../common/Kbd";
import { Icon } from "../common/Icon";
import { NoteGlyph } from "../common/NoteGlyph";
import { Badge } from "../common/UIKit";
import {
  NOTE_TYPES, EVENT_TYPES, TOOLS, HOTKEYS, PANELS,
  SHADERS, PRESETS, FORMATS,
} from "./guideData";
import {
  CanvasCoordAnimation, AboveBelowAnimation, NoteFallingAnimation,
  EventTransitionAnimation, ConstantVsTransition, EasingExplorer,
} from "./guideAnimations";

// ---- Shared text styles ----

const BODY: React.CSSProperties = { fontSize: "var(--fs-control)", color: "var(--text-secondary)", lineHeight: 1.6 };
const CAPTION: React.CSSProperties = { fontSize: "var(--fs-caption)", color: "var(--text-secondary)", lineHeight: 1.5 };
const STRONG: React.CSSProperties = { color: "var(--text-primary)", fontWeight: 600 };
const CODE: React.CSSProperties = { fontFamily: "var(--font-mono)", color: "var(--accent-primary)" };

/** 28px icon chip used in card headers. */
function IconChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      width: 28, height: 28, borderRadius: "var(--radius-md)", flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "var(--fill-hover)", color: "var(--text-secondary)",
    }}>{children}</span>
  );
}

// ---- Welcome ----

export function WelcomeTab() {
  const concepts: { glyph: React.ReactNode; title: string; desc: string }[] = [
    { glyph: <Icon icon={Minus} size={16} style={{ color: "var(--accent-primary)" }} />, title: "Judgment lines", desc: "Lines move, rotate, and fade across the screen. Notes fall toward them." },
    { glyph: <NoteGlyph kind="tap" size={16} />, title: "Notes", desc: "4 note types (Tap, Drag, Flick, Hold) that players interact with." },
    { glyph: <Icon icon={Spline} size={16} style={{ color: "var(--accent-primary)" }} />, title: "Events", desc: "Animations that control line position, rotation, opacity, and speed over time." },
  ];

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "var(--space-16)" }}>
        <div style={{ fontSize: "var(--fs-display)", lineHeight: "26px", fontWeight: 600, color: "var(--text-primary)" }}>
          Welcome to PhiChain
        </div>
        <div style={{ ...BODY, marginTop: "var(--space-4)" }}>
          A chart editor for the rhythm game Phigros. Create charts with moving judgment lines,
          falling notes, and dramatic animations.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-8)", marginBottom: "var(--space-16)" }}>
        {concepts.map(c => (
          <GCard key={c.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <IconChip>{c.glyph}</IconChip>
            <div style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)", marginTop: "var(--space-6)" }}>{c.title}</div>
            <div style={{ ...CAPTION, marginTop: "var(--space-4)" }}>{c.desc}</div>
          </GCard>
        ))}
      </div>

      <GCard>
        <div style={{ ...BODY, lineHeight: 1.8 }}>
          <strong style={STRONG}>Quick start:</strong> Press <Kbd>Ctrl+N</Kbd> to create a new chart,
          or <Kbd>Ctrl+O</Kbd> to import an existing chart. Then use the toolbar to place notes
          and the keyframe bar to animate lines. Press <Kbd>Space</Kbd> to preview your work.
        </div>
      </GCard>

      <div style={{ ...CAPTION, textAlign: "center", marginTop: "var(--space-16)" }}>
        Navigate the tabs on the left to learn each concept, or click <strong style={STRONG}>Next</strong> below.
      </div>
    </div>
  );
}

// ---- Canvas ----

export function CanvasTab({ active }: { active: boolean }) {
  return (
    <div>
      <STitle>Coordinate system</STitle>
      <GCard>
        <CanvasCoordAnimation active={active} />
        <div style={{ ...CAPTION, textAlign: "center", marginTop: "var(--space-6)" }}>
          The canvas is <strong style={STRONG}>1350 × 900</strong> units.
          Origin (0, 0) is at the center. X ranges from <span style={{ fontFamily: "var(--font-mono)" }}>-675</span> to <span style={{ fontFamily: "var(--font-mono)" }}>+675</span>,
          Y from <span style={{ fontFamily: "var(--font-mono)" }}>-450</span> to <span style={{ fontFamily: "var(--font-mono)" }}>+450</span>.
        </div>
      </GCard>

      <STitle>Above and below</STitle>
      <GCard>
        <AboveBelowAnimation active={active} />
        <div style={{ ...CAPTION, textAlign: "center", marginTop: "var(--space-4)" }}>
          Notes can fall from <strong style={STRONG}>above</strong> or
          rise from <strong style={STRONG}>below</strong> the judgment line.
          Press <Kbd>F</Kbd> to flip selected notes between sides.
        </div>
      </GCard>

      <STitle>Beat system</STitle>
      <GCard>
        <div style={BODY}>
          Time is measured in <strong style={STRONG}>beats</strong>, stored as{" "}
          <code style={CODE}>[whole, numerator, denominator]</code> tuples.
          <br />
          Example: <code style={CODE}>[2, 3, 4]</code> = beat 2 + 3/4 = <strong style={STRONG}>2.75</strong>.
          <br />
          The <strong style={STRONG}>density</strong> setting (1-32) controls how finely
          the beat grid subdivides. Density 4 = quarter-beat snapping.
        </div>
      </GCard>
    </div>
  );
}

// ---- Notes ----

export function NotesTab({ active }: { active: boolean }) {
  return (
    <div>
      <STitle>Note types</STitle>
      <GCard style={{ marginBottom: "var(--space-10)" }}>
        <NoteFallingAnimation active={active} />
      </GCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
        {NOTE_TYPES.map(n => (
          <GCard key={n.kind}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-4)" }}>
              <NoteGlyph kind={n.kind} size={16} />
              <span style={{ fontWeight: 600, fontSize: "var(--fs-body)", color: "var(--text-primary)" }}>{n.label}</span>
              <Kbd>{n.shortcut}</Kbd>
            </div>
            <div style={CAPTION}>{n.desc}</div>
          </GCard>
        ))}
      </div>

      <STitle>Key note properties</STitle>
      <GCard>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "var(--space-2) var(--space-10)", fontSize: "var(--fs-caption)", lineHeight: 1.7 }}>
          {[
            ["beat", "When to hit — stored as [whole, num, denom]"],
            ["x", "Position on the line (-675 to +675)"],
            ["above", "Falls from above (true) or below (false)"],
            ["speed", "Fall speed multiplier (default 1.0)"],
            ["hold_beat", "Duration for Hold notes"],
            ["fake", "Displays but doesn't count for combo"],
          ].map(([prop, desc]) => (
            <div key={prop} style={{ display: "contents" }}>
              <code style={CODE}>{prop}</code>
              <span style={{ color: "var(--text-secondary)" }}>{desc}</span>
            </div>
          ))}
        </div>
      </GCard>
    </div>
  );
}

// ---- Events ----

export function EventsTab({ active }: { active: boolean }) {
  return (
    <div>
      <STitle>How events work</STitle>
      <GCard style={{ marginBottom: "var(--space-8)" }}>
        <EventTransitionAnimation active={active} />
      </GCard>

      <STitle>Constant vs. transition</STitle>
      <GCard style={{ marginBottom: "var(--space-8)" }}>
        <ConstantVsTransition active={active} />
        <div style={{ ...CAPTION, textAlign: "center", marginTop: "var(--space-6)" }}>
          <strong style={STRONG}>Constant</strong> events hold a fixed value.{" "}
          <strong style={STRONG}>Transition</strong> events smoothly interpolate
          from start to end using an easing curve.
        </div>
      </GCard>

      <STitle>Core events (5)</STitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {EVENT_TYPES.filter(e => e.group === "core").map(ev => (
          <GCard key={ev.kind}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
              <ColorDot color={ev.color} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-control)" }}>{ev.label}</span>
                <span style={{ fontSize: "var(--fs-caption)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", marginLeft: "var(--space-8)" }}>{ev.range}</span>
                <div style={{ ...CAPTION, marginTop: 1 }}>{ev.desc}</div>
              </div>
            </div>
          </GCard>
        ))}
      </div>

      <STitle>Extended RPE events (6)</STitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        {EVENT_TYPES.filter(e => e.group === "rpe").map(ev => (
          <GCard key={ev.kind}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
              <ColorDot color={ev.color} />
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-control)" }}>{ev.label}</span>
            </div>
            <div style={{ ...CAPTION, marginTop: "var(--space-2)" }}>{ev.desc}</div>
          </GCard>
        ))}
      </div>

      <STitle>Event layers</STitle>
      <GCard>
        <div style={{ ...CAPTION, lineHeight: 1.6 }}>
          RPE charts support up to <strong style={STRONG}>5 additive event layers</strong> per line.
          Values from all layers are summed for the final result. Layer selector: <strong style={STRONG}>-1</strong> = flat (default), <strong style={STRONG}>0-4</strong> = specific layer.
        </div>
      </GCard>
    </div>
  );
}

// ---- Easings ----

export function EasingsTab({ active }: { active: boolean }) {
  return (
    <div>
      <STitle>Easing curve explorer</STitle>
      <div style={{ ...CAPTION, marginBottom: "var(--space-8)" }}>
        Easing curves control the acceleration of transitions. Click any curve below to see it animate.
        There are <strong style={STRONG}>33 built-in curves</strong> across 11 families.
      </div>
      <EasingExplorer active={active} />
    </div>
  );
}

// ---- Tools ----

export function ToolsTab() {
  return (
    <div>
      <STitle>Editor tools</STitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {TOOLS.map(t => (
          <GCard key={t.id}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)" }}>
              <IconChip>
                {t.note ? <NoteGlyph kind={t.note} size={16} /> : t.icon ? <Icon icon={t.icon} size={16} /> : null}
              </IconChip>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-control)" }}>{t.label}</span>
                  <Kbd>{t.key}</Kbd>
                </div>
                <div style={{ ...CAPTION, marginTop: 1 }}>{t.desc}</div>
              </div>
            </div>
          </GCard>
        ))}
      </div>

      <STitle>Beat sync mode</STitle>
      <GCard>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <Kbd>T</Kbd>
          <div style={CAPTION}>
            When <strong style={STRONG}>beat sync</strong> is on, notes are placed at the current
            playhead beat instead of where you click vertically. Great for placing notes while playing.
          </div>
        </div>
      </GCard>

      <STitle>Typical workflow</STitle>
      <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: "var(--space-8) var(--space-10)", marginTop: "var(--space-4)" }}>
        {[
          ["1", "Select a note tool (Q/W/E/R) or use the toolbar"],
          ["2", "Click on the timeline or canvas to place notes at beat positions"],
          ["3", "Use Select (V) to adjust, then animate lines with events in the keyframe bar"],
        ].map(([n, desc]) => (
          <div key={n} style={{ display: "contents" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "var(--radius-full)", background: "var(--accent-tint)",
              color: "var(--accent-primary)", fontSize: "var(--fs-control)", fontWeight: 600, display: "flex", alignItems: "center",
              justifyContent: "center", fontFamily: "var(--font-mono)",
            }}>{n}</div>
            <div style={{ ...BODY, paddingTop: "var(--space-2)" }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Panels ----

export function PanelsTab() {
  const tierConfig = [
    { tier: "always" as const, label: "Always visible", desc: "Core panels that are always accessible." },
    { tier: "quick" as const, label: "Quick access", desc: "Toggle with Alt+1/2/3 in the bottom drawer." },
    { tier: "on_demand" as const, label: "On demand", desc: "Open via the command palette (Ctrl+K) or menus." },
  ];

  return (
    <div>
      <STitle>Panel tier system</STitle>
      <div style={{ ...CAPTION, marginBottom: "var(--space-10)" }}>
        Panels are organized into 3 tiers based on how often you need them.
      </div>
      {tierConfig.map(tc => (
        <GCard key={tc.tier} style={{ marginBottom: "var(--space-8)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-8)", marginBottom: "var(--space-6)" }}>
            <span style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-primary)" }}>{tc.label}</span>
            <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{tc.desc}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {PANELS.filter(p => p.tier === tc.tier).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", fontSize: "var(--fs-caption)" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)", minWidth: 100 }}>{p.id}</span>
                <span style={{ color: "var(--text-secondary)" }}>{p.desc}</span>
              </div>
            ))}
          </div>
        </GCard>
      ))}
    </div>
  );
}

// ---- Shortcuts ----

export function ShortcutsTab() {
  return (
    <div>
      <STitle>Keyboard shortcuts</STitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-14) var(--space-16)" }}>
        {HOTKEYS.map(cat => (
          <div key={cat.cat}>
            <div style={{
              fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)",
              marginBottom: "var(--space-4)", paddingBottom: "var(--space-4)",
              borderBottom: "var(--rule) solid var(--separator)",
            }}>
              {cat.cat}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {cat.keys.map(k => (
                <div key={k.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-8)", fontSize: "var(--fs-caption)", padding: "var(--space-2) 0" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{k.action}</span>
                  <Kbd>{k.key}</Kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Advanced ----

export function AdvancedTab() {
  return (
    <div>
      <STitle>Record mode</STitle>
      <GCard>
        <div style={{ ...CAPTION, lineHeight: 1.6 }}>
          <Kbd>Alt+R</Kbd> — Record X/Y/rotation keyframes by moving lines during playback.
          Channels (X, Y, rotation) are toggleable. Recorded keyframes can be simplified
          with the Ramer-Douglas-Peucker algorithm before committing as events.
        </div>
      </GCard>

      <STitle>Mark / improvisation mode</STitle>
      <GCard>
        <div style={{ ...CAPTION, lineHeight: 1.6 }}>
          <Kbd>Shift+I</Kbd> — Place colored bookmarks during playback by pressing Q/W/E/R (note types)
          or 1/2/3 (colored markers). Convert bookmarks to real notes afterwards.
          Built-in latency compensation (-40ms default).
        </div>
      </GCard>

      <STitle>Event presets</STitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        {PRESETS.map(p => (
          <GCard key={p.cat}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-control)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>{p.cat}</div>
            <div style={CAPTION}>{p.items.join(", ")}</div>
          </GCard>
        ))}
      </div>

      <STitle>Shader effects</STitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
        {SHADERS.map(s => (
          <GCard key={s.name}>
            <code style={{ ...CODE, fontSize: "var(--fs-caption)" }}>{s.name}</code>
            <div style={{ ...CAPTION, marginTop: 1 }}>{s.desc}</div>
          </GCard>
        ))}
      </div>

      <STitle>Import / export formats</STitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {FORMATS.map(f => (
          <GCard key={f.name}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "var(--fs-control)", color: "var(--text-primary)" }}>{f.name}</span>
              <Badge color="var(--accent-primary)">{f.dir}</Badge>
            </div>
            <div style={{ ...CAPTION, marginTop: "var(--space-2)" }}>{f.desc}</div>
          </GCard>
        ))}
      </div>
    </div>
  );
}

// ---- Tips ----

export function TipsTab() {
  const tips = [
    { title: "Start simple", desc: "Begin with one line at the center. Add notes first, then animate with events." },
    { title: "Use the grid", desc: "Set density to match the song's rhythm (4 = quarter-beat, 8 = eighth-note, 16 = sixteenth)." },
    { title: "Preview often", desc: "Press Space to play. Use 0.5× speed for tricky sections. The game preview shows exactly what players see." },
    { title: "Multiple lines", desc: "Real Phigros charts use many independently moving lines. Start with 2-3, then add more for complexity." },
    { title: "Undo is your friend", desc: "Ctrl+Z gives you 200 undo steps. Experiment freely!" },
    { title: "Speed events for drama", desc: "Set speed to 0 before a music drop (freeze notes), then snap back to 1 for impact." },
    { title: "Invisible lines are powerful", desc: "Set opacity to 0 — notes still fall, but the line is invisible. Used in almost every hard chart." },
    { title: "Command palette", desc: "Press Ctrl+K to access any action instantly. Search for presets, generators, settings, and more." },
    { title: "Learn easing curves", desc: "The difference between a good and great chart is in the easing. ease_out gives smooth landings, ease_in_out gives gentle motion." },
    { title: "Happy charting!", desc: "Join the Phigros custom chart community, share your work, and play other people's charts for inspiration." },
  ];

  return (
    <div>
      <STitle>Tips and best practices</STitle>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {tips.map((tip, i) => (
          <GCard key={i}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-control)", color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>{tip.title}</div>
            <div style={CAPTION}>{tip.desc}</div>
          </GCard>
        ))}
      </div>
    </div>
  );
}
