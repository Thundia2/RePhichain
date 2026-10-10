// ============================================================
// Prompt Dialog — Promise-based styled replacement for prompt()
//
// Usage from anywhere:
//   import { showPrompt } from "./PromptDialog";
//   const v = await showPrompt({ title: "Set rotation", label: "Rotation in degrees", defaultValue: "0" });
//   if (v !== null) { ... }
// ============================================================

import { useEffect, useId, useState } from "react";
import { create } from "zustand";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { INPUT_STYLE } from "./UIKit";

export interface PromptOptions {
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  inputMode?: "text" | "decimal" | "numeric";
  /** Return an error message to block submit, or null when valid. */
  validate?: (value: string) => string | null;
}

interface PromptState {
  options: PromptOptions | null;
  resolve: ((value: string | null) => void) | null;
  showPrompt: (options: PromptOptions) => Promise<string | null>;
  respond: (value: string | null) => void;
}

const usePromptStore = create<PromptState>()((set, get) => ({
  options: null,
  resolve: null,
  showPrompt: (options) =>
    new Promise<string | null>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(null);
      set({ options, resolve });
    }),
  respond: (value) => {
    const { resolve } = get();
    if (resolve) resolve(value);
    set({ options: null, resolve: null });
  },
}));

/** Call from anywhere (including outside React) to ask for a single value. */
// eslint-disable-next-line react-refresh/only-export-components
export const showPrompt = (options: PromptOptions) => usePromptStore.getState().showPrompt(options);

export function PromptDialog() {
  const { options, respond } = usePromptStore();
  if (!options) return null;
  return <PromptDialogInner key={options.title + options.label} options={options} respond={respond} />;
}

function PromptDialogInner({ options, respond }: { options: PromptOptions; respond: (v: string | null) => void }) {
  const inputId = useId();
  const [value, setValue] = useState(options.defaultValue ?? "");
  const error = options.validate ? options.validate(value) : null;

  // Keep editor hotkeys from firing behind the dialog while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== "Escape") e.stopPropagation(); };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const submit = () => { if (!error) respond(value); };

  return (
    <Dialog
      title={options.title}
      onClose={() => respond(null)}
      width={360}
      zIndex="calc(var(--z-modal) + 10)"
      footer={
        <>
          <Button onClick={() => respond(null)}>Cancel</Button>
          <Button variant="primary" disabled={!!error} onClick={submit}>{options.confirmLabel ?? "Apply"}</Button>
        </>
      }
    >
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
      >
        <label htmlFor={inputId} style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>{options.label}</label>
        <input
          id={inputId}
          data-autofocus
          inputMode={options.inputMode}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={!!error}
          style={{
            ...INPUT_STYLE,
            fontFamily: options.inputMode ? "var(--font-mono)" : "inherit",
            borderColor: error ? "var(--error)" : undefined,
          }}
        />
        {error && <div style={{ fontSize: "var(--fs-caption)", color: "var(--error)" }}>{error}</div>}
      </form>
    </Dialog>
  );
}
