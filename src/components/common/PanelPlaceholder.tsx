import { PanelTop } from "lucide-react";
import { Icon } from "./Icon";

interface PanelPlaceholderProps {
  name: string;
  description: string;
  /** Icon colour (a token, e.g. "var(--text-muted)"). */
  color: string;
}

/**
 * A placeholder that's shown inside panels that haven't been
 * built yet. Displays a panel icon, the panel name and a short
 * description of what will go here.
 *
 * These will be replaced with real components in Phases 4-6.
 */
export function PanelPlaceholder({ name, description, color }: PanelPlaceholderProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-8)",
        padding: "var(--space-16)",
        textAlign: "center",
      }}
    >
      <Icon icon={PanelTop} size={20} style={{ color }} />
      <div style={{ fontSize: "var(--fs-headline)", lineHeight: "18px", fontWeight: 600, color: "var(--text-primary)" }}>
        {name}
      </div>
      <div style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
        {description}
      </div>
    </div>
  );
}
