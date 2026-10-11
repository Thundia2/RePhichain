// Shared ContextBadge — what the panel is acting on. Renders the design
// system's SelectionSummary (bg-active, no border, accent icon).

import type React from "react";
import type { LucideIcon } from "lucide-react";
import { SelectionSummary } from "../../common/SelectionSummary";

export function ContextBadge({ icon, label, detail }: {
  icon?: LucideIcon | React.ReactNode;
  label: React.ReactNode;
  detail?: React.ReactNode;
  /** Kept for call-site compatibility; the summary no longer tints by mode. */
  variant?: "line" | "note" | "event" | "global";
}) {
  return <SelectionSummary icon={icon} label={label} detail={detail} />;
}
