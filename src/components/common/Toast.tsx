// ============================================================
// Toast Container — Renders notification toasts bottom-right
//
// Each toast pairs its status colour with an icon (status colours
// are never the only signal) and sits on the popover surface.
// ============================================================

import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { useToastStore, type Toast } from "../../stores/toastStore";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";

const TYPE_STYLE: Record<Toast["type"], { color: string; icon: LucideIcon; label: string }> = {
  error: { color: "var(--error)", icon: CircleAlert, label: "Error" },
  info: { color: "var(--info)", icon: Info, label: "Info" },
  success: { color: "var(--success)", icon: CircleCheck, label: "Success" },
  warning: { color: "var(--warning)", icon: TriangleAlert, label: "Warning" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [exiting, setExiting] = useState(false);
  const { color, icon, label } = TYPE_STYLE[toast.type];

  useEffect(() => {
    const fadeTimer = setTimeout(() => setExiting(true), toast.duration - 200);
    const removeTimer = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, removeToast]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-8)",
        padding: "var(--space-8) var(--space-6) var(--space-8) var(--space-10)",
        backgroundColor: "var(--bg-tertiary)",
        border: "var(--rule) solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-popover)",
        maxWidth: 340,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(4px)" : "none",
        transition: "opacity var(--dur-base), transform var(--dur-base)",
        animation: "toastIn var(--dur-base) var(--ease-out)",
      }}
    >
      <span style={{ display: "inline-flex", paddingTop: 2, color }} aria-label={label}>
        <Icon icon={icon} />
      </span>
      <div style={{ flex: 1, fontSize: "var(--fs-body)", lineHeight: "18px", color: "var(--text-primary)" }}>
        {toast.message}
      </div>
      <IconButton icon={X} label="Dismiss" size="sm" onClick={() => removeToast(toast.id)} />
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: "var(--space-24)",
          right: "var(--space-16)",
          zIndex: "var(--z-toast)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-8)",
          pointerEvents: "auto",
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
}
