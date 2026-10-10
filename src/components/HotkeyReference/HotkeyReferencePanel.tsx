// ============================================================
// Hotkey Reference Panel
//
// Quick-reference card showing all keyboard shortcuts grouped
// by category. Accessible via Command Palette or View menu.
// Rendered with the shared HotkeyList (cards of label + Kbd).
// ============================================================

import { HotkeyList, type HotkeySection } from "../ContextPanel/shared/HotkeyList";

const HOTKEY_GROUPS: HotkeySection[] = [
  {
    title: "Tools",
    keys: [
      { hotkey: "V", label: "Select tool" },
      { hotkey: "X", label: "Eraser tool" },
      { hotkey: "Q", label: "Place tap" },
      { hotkey: "W", label: "Place drag" },
      { hotkey: "E", label: "Place flick" },
      { hotkey: "R", label: "Place hold" },
    ],
  },
  {
    title: "Panels",
    keys: [
      { hotkey: "L", label: "Toggle line drawer" },
      { hotkey: "I", label: "Toggle inspector" },
      { hotkey: "K", label: "Toggle keyframe bar" },
      { hotkey: "Shift+K", label: "Toggle curve editor" },
      { hotkey: "Alt+1", label: "Timeline panel" },
      { hotkey: "Alt+2", label: "Lines panel" },
      { hotkey: "Alt+3", label: "Effects panel" },
    ],
  },
  {
    title: "Playback",
    keys: [
      { hotkey: "Space", label: "Play / pause" },
      { hotkey: "Left / Right", label: "Seek backward / forward" },
    ],
  },
  {
    title: "Editing",
    keys: [
      { hotkey: "Ctrl+Z", label: "Undo" },
      { hotkey: "Ctrl+Shift+Z", label: "Redo" },
      { hotkey: "Ctrl+C", label: "Copy" },
      { hotkey: "Ctrl+X", label: "Cut" },
      { hotkey: "Ctrl+V", label: "Paste" },
      { hotkey: "Delete", label: "Delete selected" },
      { hotkey: "F", label: "Flip above/below" },
    ],
  },
  {
    title: "Other",
    keys: [
      { hotkey: "Ctrl+K", label: "Command palette" },
      { hotkey: "Ctrl+N", label: "New chart" },
      { hotkey: "Ctrl+S", label: "Save project" },
      { hotkey: "Alt+R", label: "Toggle record mode" },
      { hotkey: "Alt+M", label: "Toggle improvisation mode" },
    ],
  },
];

export function HotkeyReferencePanel() {
  return (
    <div style={{ padding: "var(--space-12)", overflow: "auto", height: "100%" }}>
      <div style={{ fontSize: "var(--fs-headline)", fontWeight: 600, color: "var(--text-primary)" }}>
        Keyboard shortcuts
      </div>
      <HotkeyList sections={HOTKEY_GROUPS} />
    </div>
  );
}
