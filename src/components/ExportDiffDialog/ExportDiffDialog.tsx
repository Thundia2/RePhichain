// ============================================================
// Export Diff Dialog
//
// Shows a summary comparing the current chart vs. the original
// chart loaded from disk. Counts added/removed lines, notes,
// and events. Rendered in the shared Dialog chrome.
// ============================================================

import { GitCompare } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { Dialog } from "../common/Dialog";
import { Button } from "../common/Button";

interface ExportDiffDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDiffDialog({ open, onClose }: ExportDiffDialogProps) {
  const diff = useChartStore((s) => s.getDiffSummary());

  if (!open) return null;

  return (
    <Dialog
      title="Chart changes summary"
      icon={GitCompare}
      onClose={onClose}
      width={320}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {diff === null ? (
        <div style={{ fontSize: "var(--fs-body)", color: "var(--text-secondary)" }}>
          No original chart to compare against. Load a chart first.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <DiffRow label="Lines" added={diff.linesAdded} removed={diff.linesRemoved} />
          <DiffRow label="Notes" added={diff.notesAdded} removed={diff.notesRemoved} />
          <DiffRow label="Events" added={diff.eventsAdded} removed={diff.eventsRemoved} />
        </div>
      )}
    </Dialog>
  );
}

function DiffRow({ label, added, removed }: { label: string; added: number; removed: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-6) var(--space-10)",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--bg-active)",
        fontSize: "var(--fs-body)",
        color: "var(--text-primary)",
      }}
    >
      <span>{label}</span>
      <div style={{ display: "flex", gap: "var(--space-12)", fontFamily: "var(--font-mono)" }}>
        <span style={{ color: added > 0 ? "var(--success)" : "var(--text-muted)" }}>
          +{added}
        </span>
        <span style={{ color: removed > 0 ? "var(--error)" : "var(--text-muted)" }}>
          -{removed}
        </span>
      </div>
    </div>
  );
}
