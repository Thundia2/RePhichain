// Shared HotkeyList — read-only shortcut reference for the "Hotkeys" tabs:
// sentence-case section headers over cards of label + Kbd rows.

import { Card } from "../../common/UIKit";
import { Kbd } from "../../common/Kbd";
import { SectionHeader } from "./SectionHeader";
import { useShortcutText, type ShortcutRef } from "../../../hooks/useHotkeyLabel";

export interface HotkeySection {
  title: string;
  /** `hotkey` is fixed key text, or `{ action }` for a rebindable registry shortcut. */
  keys: { label: string; hotkey: ShortcutRef }[];
}

export function HotkeyList({ sections }: { sections: HotkeySection[] }) {
  const text = useShortcutText();
  return (
    <div>
      {sections.map((section) => (
        <div key={section.title}>
          <SectionHeader label={section.title} />
          <Card>
            {section.keys.map((k, i) => (
              <div
                key={k.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-8)",
                  minHeight: "var(--control-lg)",
                  padding: "var(--space-4) var(--space-10)",
                  borderBottom: i === section.keys.length - 1 ? "none" : "var(--rule) solid var(--separator)",
                  fontSize: "var(--fs-control)",
                }}
              >
                <span style={{ color: "var(--text-primary)" }}>{k.label}</span>
                {k.hotkey ? <Kbd>{text(k.hotkey)}</Kbd> : <span style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
