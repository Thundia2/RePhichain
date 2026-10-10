// ============================================================
// Tooltip Component
//
// Shows a label (and optional shortcut chip) on hover or keyboard
// focus. Rendered in a portal with fixed positioning so it never
// gets clipped by scrolling panels (in the trigger's own document, so
// popped-out panels get their tooltips in their window). The wrapper uses
// `display: contents`, so wrapping a control doesn't change layout.
// ============================================================

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Kbd } from "./Kbd";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
}

const GAP = 6;

export function Tooltip({
  content,
  shortcut,
  children,
  position = "top",
  delay = 400,
  disabled,
}: TooltipProps) {
  const [coords, setCoords] = useState<{ left: number; top: number; transform: string } | null>(null);
  // Portal into the trigger's own document, so tooltips work in popped-out windows too.
  const [host, setHost] = useState<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const target = wrapRef.current?.firstElementChild;
    if (!target) return;
    const r = target.getBoundingClientRect();
    setHost(target.ownerDocument.body);
    switch (position) {
      case "bottom":
        setCoords({ left: r.left + r.width / 2, top: r.bottom + GAP, transform: "translateX(-50%)" });
        break;
      case "left":
        setCoords({ left: r.left - GAP, top: r.top + r.height / 2, transform: "translate(-100%, -50%)" });
        break;
      case "right":
        setCoords({ left: r.right + GAP, top: r.top + r.height / 2, transform: "translateY(-50%)" });
        break;
      default:
        setCoords({ left: r.left + r.width / 2, top: r.top - GAP, transform: "translate(-50%, -100%)" });
    }
  }, [position]);

  const show = (immediate: boolean) => {
    if (disabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (immediate) place();
    else timerRef.current = setTimeout(place, delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCoords(null);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span
      ref={wrapRef}
      style={{ display: "contents" }}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) show(true); }}
      onBlur={hide}
    >
      {children}
      {coords &&
        createPortal(
          <div role="tooltip" className="ui-tooltip" style={coords}>
            <span>{content}</span>
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </div>,
          host ?? document.body,
        )}
    </span>
  );
}
