// ============================================================
// Confirm Dialog — Promise-based styled replacement for confirm()
//
// Usage from anywhere:
//   import { showConfirm } from "./ConfirmDialog";
//   if (await showConfirm("Delete this item?")) { ... }
//   if (await showConfirm("This can't be undone.", { title: "Delete line?", confirmLabel: "Delete", danger: true })) { ... }
// ============================================================

import { useEffect } from "react";
import { create } from "zustand";
import { TriangleAlert, CircleHelp } from "lucide-react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action: red confirm button and warning icon. */
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  message: string;
  options: ConfirmOptions;
  resolve: ((result: boolean) => void) | null;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  respond: (result: boolean) => void;
}

const useConfirmStore = create<ConfirmState>()((set, get) => ({
  open: false,
  message: "",
  options: {},
  resolve: null,

  showConfirm: (message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      // If already open, resolve the previous one as false
      const prev = get().resolve;
      if (prev) prev(false);
      set({ open: true, message, options, resolve });
    });
  },

  respond: (result: boolean) => {
    const { resolve } = get();
    if (resolve) resolve(result);
    set({ open: false, message: "", options: {}, resolve: null });
  },
}));

/** Call from anywhere (including outside React) to show a styled confirm dialog */
// eslint-disable-next-line react-refresh/only-export-components
export const showConfirm = (message: string, options?: ConfirmOptions) =>
  useConfirmStore.getState().showConfirm(message, options);

export function ConfirmDialog() {
  const { open, message, options, respond } = useConfirmStore();

  // Q5: suppress global hotkeys while the modal is open. The capture-phase window
  // listener runs before react-hotkeys-hook's document listener, so stopPropagation()
  // keeps editor hotkeys from firing behind the modal; Enter confirms (Esc is handled
  // by Dialog, which only closes the topmost dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); respond(true); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, respond]);

  if (!open) return null;

  return (
    <Dialog
      role="alertdialog"
      title={options.title ?? "Are you sure?"}
      icon={options.danger ? TriangleAlert : CircleHelp}
      iconColor={options.danger ? "var(--error)" : undefined}
      onClose={() => respond(false)}
      width={380}
      zIndex="calc(var(--z-modal) + 10)"
      footer={
        <>
          {/* Destructive confirms start on Cancel, so a stray Enter can't trigger them. */}
          <Button onClick={() => respond(false)} data-autofocus={options.danger || undefined}>
            {options.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={options.danger ? "danger" : "primary"}
            onClick={() => respond(true)}
            data-autofocus={!options.danger || undefined}
          >
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: "var(--fs-body)", lineHeight: "18px", color: "var(--text-secondary)" }}>{message}</p>
    </Dialog>
  );
}
