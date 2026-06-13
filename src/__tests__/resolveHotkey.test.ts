// ============================================================
// Hotkey registry binding (finding L7)
//
// Locks the resolver contract (override ?? registry default) that finally makes the
// rebinding feature live, plus the registry invariants the L7 remap depends on:
// the displaced/drifted bindings landed where the user chose, the dead orphans are
// gone, and the whole keymap is conflict-free (so HotkeySettings' conflict checker
// shows a clean slate by default). grep resolveHotkey.
// ============================================================

import { describe, it, expect } from "vitest";
import { resolveHotkey } from "../utils/resolveHotkey";
import { DEFAULT_HOTKEYS } from "../constants/defaultHotkeys";

describe("resolveHotkey (L7)", () => {
  it("returns the user override when present", () => {
    expect(resolveHotkey({ save: "ctrl+shift+s" }, "save")).toBe("ctrl+shift+s");
  });

  it("falls back to the registry default when no override for that id", () => {
    expect(resolveHotkey({}, "save")).toBe(DEFAULT_HOTKEYS.save.key);
    expect(resolveHotkey({ undo: "x" }, "save")).toBe(DEFAULT_HOTKEYS.save.key);
  });

  it("returns '' for an unknown id (react-hotkeys-hook treats '' as never-matches)", () => {
    expect(resolveHotkey({}, "nonexistent_action")).toBe("");
  });
});

describe("DEFAULT_HOTKEYS registry invariants (L7)", () => {
  it("placed the displaced/drifted bindings where the L7 decision says", () => {
    expect(DEFAULT_HOTKEYS.step_record.key).toBe("b");   // displaced off "s"
    expect(DEFAULT_HOTKEYS.pattern_tool.key).toBe("p");  // displaced off "ctrl+g"
    expect(DEFAULT_HOTKEYS.split_event.key).toBe("s");   // reclaimed "s"
    expect(DEFAULT_HOTKEYS.go_to_beat.key).toBe("ctrl+g, meta+g"); // drift fix off ctrl+j
    expect(DEFAULT_HOTKEYS.redo.key).toContain("ctrl+y"); // alias folded into the superset
  });

  it("removed the dead orphan ids (no underlying operation existed)", () => {
    expect(DEFAULT_HOTKEYS.merge_events).toBeUndefined();
    expect(DEFAULT_HOTKEYS.swap_easing).toBeUndefined();
  });

  it("is conflict-free — no two actions share a key combo", () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const [action, def] of Object.entries(DEFAULT_HOTKEYS)) {
      for (const combo of def.key.split(",").map((s) => s.trim())) {
        const prior = seen.get(combo);
        if (prior) dups.push(`${combo}: ${prior} vs ${action}`);
        else seen.set(combo, action);
      }
    }
    expect(dups).toEqual([]);
  });
});
