// ============================================================
// Hotkey Reference Panel
//
// Quick-reference card showing all keyboard shortcuts grouped
// by category. Accessible via Command Palette or View menu.
// Rendered with the shared HotkeyList (cards of label + Kbd).
// Rebindable shortcuts come from the hotkey registry, so they show
// the current binding from Settings > Hotkeys; the fixed ones below
// are bound directly in useHotkeys / useClipboard.
// ============================================================

import { HotkeyList, type HotkeySection } from "../ContextPanel/shared/HotkeyList";
import { DEFAULT_HOTKEYS, HOTKEY_CATEGORIES } from "../../constants/defaultHotkeys";

const REBINDABLE: HotkeySection[] = HOTKEY_CATEGORIES.map((category) => ({
  title: category,
  keys: Object.entries(DEFAULT_HOTKEYS)
    .filter(([, def]) => def.category === category)
    .map(([action, def]) => ({ label: def.label, hotkey: { action } })),
})).filter((section) => section.keys.length > 0);

const FIXED: HotkeySection[] = [
  {
    title: "Panels",
    keys: [
      { hotkey: "L", label: "Toggle line drawer" },
      { hotkey: "I", label: "Toggle inspector" },
      { hotkey: "K", label: "Toggle keyframe bar" },
      { hotkey: "Shift+K", label: "Toggle curve editor" },
      { hotkey: "Ctrl+Shift+K", label: "Pop out curve editor" },
      { hotkey: "Alt+1", label: "Timeline panel" },
      { hotkey: "Alt+2", label: "Lines panel" },
      { hotkey: "Alt+3", label: "Effects panel" },
      { hotkey: "Ctrl+L", label: "Search lines" },
      { hotkey: "Shift+F", label: "Fit all lines in view" },
    ],
  },
  {
    title: "Other",
    keys: [
      { hotkey: "Ctrl+K", label: "Command palette" },
      { hotkey: "Ctrl+O", label: "Import chart" },
      { hotkey: "F2", label: "Rename tab" },
      { hotkey: "Ctrl+C", label: "Copy" },
      { hotkey: "Ctrl+X", label: "Cut" },
      { hotkey: "Ctrl+V", label: "Paste" },
      { hotkey: "Ctrl+Shift+G", label: "Create group" },
      { hotkey: "T", label: "Toggle beat sync" },
      { hotkey: "Shift+X", label: "Toggle X snap" },
      { hotkey: "Shift+Up", label: "Double step size (step record)" },
      { hotkey: "Shift+Down", label: "Halve step size (step record)" },
      { hotkey: "Alt+R", label: "Toggle record mode" },
      { hotkey: "Shift+I", label: "Toggle mark mode" },
      { hotkey: "Ctrl+Shift+O", label: "Onset calibration" },
      { hotkey: "Esc", label: "Exit step record / group edit, clear loop" },
    ],
  },
];

export function HotkeyReferencePanel() {
  return (
    <div style={{ padding: "var(--space-12)", overflow: "auto", height: "100%" }}>
      <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600, color: "var(--text-primary)" }}>
        Keyboard shortcuts
      </div>
      <div style={{ fontSize: "var(--fs-caption)", color: "var(--text-secondary)", marginTop: "var(--space-4)" }}>
        Tools through View can be changed in Settings &gt; Hotkeys. Panels and Other are fixed.
      </div>
      <HotkeyList sections={[...REBINDABLE, ...FIXED]} />
    </div>
  );
}
