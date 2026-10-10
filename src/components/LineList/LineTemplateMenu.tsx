// ============================================================
// Line Template Menu
//
// Dropdown menu with pre-configured line templates for common
// line types. Supports single and batch (e.g., "All UI lines")
// creation. A ui-popover of ui-menu-items with Lucide icons.
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Gamepad2, Captions, Hash, Percent, Tag, Music, SignalHigh, RectangleHorizontal,
  Pause, Layers, EyeOff, ImageIcon, LayoutTemplate,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { Icon } from "../common/Icon";
import { IconButton } from "../common/IconButton";
import type { Line, LineEvent, Beat } from "../../types/chart";

// A baseline-free line defaults to VISIBLE (DEFAULT_LINE_STATE.opacity=1), so a
// template that wants an INVISIBLE line (text/lyrics, visual helper) needs one
// explicit opacity-0 event. It holds via inheritance (finding L4); x/y/rotation/
// speed fall back to their defaults — no [0,1000] baseline span required.
function invisibleLineEvents(): LineEvent[] {
  const start: Beat = [0, 0, 1];
  const end: Beat = [1, 0, 1];
  return [{ kind: "opacity", start_beat: start, end_beat: end, value: { constant: 0 } }];
}

interface LineTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  create?: () => Partial<Line>;
  isBatch?: boolean;
  batchTemplates?: string[];
}

const LINE_TEMPLATES: LineTemplate[] = [
  {
    id: "gameplay", label: "Gameplay line", icon: Gamepad2,
    description: "Standard line with notes",
    create: () => ({ _category: "gameplay" }),
  },
  {
    id: "text", label: "Text / lyrics line", icon: Captions,
    description: "Invisible line for text events",
    create: () => ({
      _category: "text", name: "Lyrics",
      events: invisibleLineEvents(),
    }),
  },
  {
    id: "ui-combo", label: "UI: combo counter", icon: Hash,
    create: () => ({ _category: "visual", name: "UI Combo", attach_ui: "combonumber" }),
  },
  {
    id: "ui-score", label: "UI: score", icon: Percent,
    create: () => ({ _category: "visual", name: "UI Score", attach_ui: "score" }),
  },
  {
    id: "ui-combo-label", label: "UI: combo label", icon: Tag,
    create: () => ({ _category: "visual", name: "UI Combo Label", attach_ui: "combo" }),
  },
  {
    id: "ui-name", label: "UI: song name", icon: Music,
    create: () => ({ _category: "visual", name: "UI Name", attach_ui: "name" }),
  },
  {
    id: "ui-level", label: "UI: level label", icon: SignalHigh,
    create: () => ({ _category: "visual", name: "UI Level", attach_ui: "level" }),
  },
  {
    id: "ui-bar", label: "UI: progress bar", icon: RectangleHorizontal,
    create: () => ({ _category: "visual", name: "UI Bar", attach_ui: "bar" }),
  },
  {
    id: "ui-pause", label: "UI: pause button", icon: Pause,
    create: () => ({ _category: "visual", name: "UI Pause", attach_ui: "pause" }),
  },
  {
    id: "ui-all", label: "All UI lines (7)", icon: Layers,
    description: "Creates all 7 standard UI lines at once",
    isBatch: true,
    batchTemplates: ["ui-combo", "ui-combo-label", "ui-score", "ui-name", "ui-level", "ui-bar", "ui-pause"],
  },
  {
    id: "visual-helper", label: "Visual helper line", icon: EyeOff,
    description: "Invisible line for visual effects",
    create: () => ({
      _category: "helper", name: "Helper",
      events: invisibleLineEvents(),
    }),
  },
  {
    id: "texture", label: "Texture / image line", icon: ImageIcon,
    description: "Line for displaying a custom image",
    create: () => ({ _category: "visual", name: "Image" }),
  },
];

const templateMap = new Map(LINE_TEMPLATES.filter((t) => t.create).map((t) => [t.id, t]));

export function LineTemplateMenu() {
  const [open, setOpen] = useState(false);
  const addLine = useChartStore((s) => s.addLine);
  const batchAddLines = useChartStore((s) => s.batchAddLines);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleCreate = useCallback((template: LineTemplate) => {
    if (template.isBatch && template.batchTemplates) {
      const partials = template.batchTemplates
        .map((id) => templateMap.get(id)?.create?.())
        .filter(Boolean) as Partial<Line>[];
      batchAddLines(partials);
    } else if (template.create) {
      addLine(template.create());
    }
    setOpen(false);
  }, [addLine, batchAddLines]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <IconButton
        icon={LayoutTemplate}
        label="Add line from template"
        size="md"
        className={open ? "is-active" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />

      {open && (
        <div
          role="menu"
          aria-label="Line templates"
          className="ui-popover"
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: "var(--z-dropdown)",
            marginTop: "var(--space-4)", width: 220,
            maxHeight: 300, overflowY: "auto",
          }}
        >
          {LINE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              className="ui-menu-item"
              onClick={() => handleCreate(t)}
              title={t.description}
            >
              <Icon icon={t.icon} size={14} style={{ color: "var(--text-secondary)" }} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
