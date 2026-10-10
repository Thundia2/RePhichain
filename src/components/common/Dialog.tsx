// ============================================================
// Dialog — shared modal chrome: overlay scrim, radius-2xl,
// shadow-modal, 15px title, fade + 0.98 scale entry. Every modal
// in the app renders inside this so they look and behave alike.
//
//   <Dialog title="Go to beat" onClose={close} width={320}
//     footer={<><Button onClick={close}>Cancel</Button><Button variant="primary">Go</Button></>}>
//     …body…
//   </Dialog>
// ============================================================

import { useEffect, useRef, useId, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

/** Open dialogs, oldest first — used so Esc only closes the top one. */
const dialogStack: object[] = [];

export function Dialog({
  title,
  icon,
  iconColor,
  onClose,
  children,
  footer,
  width = 420,
  height,
  closeOnBackdrop = true,
  escapeToClose = true,
  showClose = true,
  role = "dialog",
  bodyStyle,
  headerExtra,
  zIndex,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  height?: number | string;
  closeOnBackdrop?: boolean;
  escapeToClose?: boolean;
  showClose?: boolean;
  role?: "dialog" | "alertdialog";
  bodyStyle?: CSSProperties;
  /** Extra controls placed in the header, left of the close button. */
  headerExtra?: ReactNode;
  /** Override the stacking level (defaults to --z-modal). */
  zIndex?: number | string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Move focus into the dialog, and give it back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const auto = panel.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      (auto ?? panel).focus({ preventScroll: true });
    }
    return () => { previous?.focus?.({ preventScroll: true }); };
  }, []);

  // Esc closes only the topmost open dialog.
  useEffect(() => {
    const token = {};
    dialogStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !escapeToClose) return;
      if (dialogStack[dialogStack.length - 1] !== token) return;
      e.stopPropagation();
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      const i = dialogStack.indexOf(token);
      if (i >= 0) dialogStack.splice(i, 1);
    };
  }, [escapeToClose]);

  return createPortal(
    <div
      className="ui-overlay"
      style={zIndex !== undefined ? { zIndex } : undefined}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="ui-dialog"
        style={{ width, height, outline: "none" }}
      >
        <div className="ui-dialog__header">
          {icon && <Icon icon={icon} size={16} style={{ color: iconColor ?? "var(--text-secondary)" }} />}
          <h2 id={titleId} className="ui-dialog__title">{title}</h2>
          {headerExtra}
          {showClose && <IconButton icon={X} label="Close" shortcut="Esc" onClick={onClose} />}
        </div>
        <div className="ui-dialog__body" style={bodyStyle}>{children}</div>
        {footer && <div className="ui-dialog__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Small label + description block for fields inside dialogs. */
export function DialogField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", marginBottom: "var(--space-12)" }}>
      <label htmlFor={htmlFor} style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>{hint}</div>}
    </div>
  );
}
