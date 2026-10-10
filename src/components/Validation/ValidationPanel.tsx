// ============================================================
// Validation Panel
//
// Displays chart validation results. Re-validates on demand
// when the user clicks "Validate". Shows errors, warnings,
// and info messages with line/note references; severity is
// always an icon plus a word in its status colour.
// ============================================================

import { useState, useCallback } from "react";
import { CircleAlert, TriangleAlert, Info, CircleCheck, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useChartStore } from "../../stores/chartStore";
import { selectLineByIndex } from "../../stores/selection";
import { validateChart, type ValidationIssue, type ValidationSeverity } from "../../utils/chartValidation";
import { Badge } from "../common/UIKit";
import { Button } from "../common/Button";
import { Icon } from "../common/Icon";

const SEVERITY_COLORS: Record<ValidationSeverity, string> = {
  error: "var(--error)",
  warning: "var(--warning)",
  info: "var(--info)",
};

const SEVERITY_ICONS: Record<ValidationSeverity, LucideIcon> = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

export function ValidationPanel() {
  const chart = useChartStore((s) => s.chart);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const runValidation = useCallback(() => {
    const result = validateChart(chart);
    setIssues(result);
    setHasRun(true);
  }, [chart]);

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          padding: "var(--space-8) var(--space-12)",
          borderBottom: "var(--rule) solid var(--border-color)",
          flexShrink: 0,
        }}
      >
        <Button variant="primary" icon={ListChecks} onClick={runValidation}>
          Validate
        </Button>
        {hasRun && (
          <div style={{ display: "flex", gap: "var(--space-6)" }}>
            <Badge color={SEVERITY_COLORS.error}>{errorCount} error{errorCount !== 1 ? "s" : ""}</Badge>
            <Badge color={SEVERITY_COLORS.warning}>{warningCount} warning{warningCount !== 1 ? "s" : ""}</Badge>
            <Badge color={SEVERITY_COLORS.info}>{infoCount} info</Badge>
          </div>
        )}
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!hasRun && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <span style={{ fontSize: "var(--fs-control)", color: "var(--text-secondary)" }}>
              Click "Validate" to check for issues
            </span>
          </div>
        )}
        {hasRun && issues.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-6)",
                fontSize: "var(--fs-control)",
                color: "var(--success)",
              }}
            >
              <Icon icon={CircleCheck} size={14} />
              No issues found
            </span>
          </div>
        )}
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className="ui-hover"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-10)",
              padding: "var(--space-8) var(--space-12)",
              borderBottom: "var(--rule) solid var(--separator)",
              cursor: "pointer",
            }}
            onClick={() => {
              if (issue.lineIndex !== undefined) {
                selectLineByIndex(issue.lineIndex);
              }
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-4)",
                flexShrink: 0,
                minWidth: 64,
                fontSize: "var(--fs-control)",
                fontWeight: 600,
                lineHeight: 1.4,
                color: SEVERITY_COLORS[issue.severity],
              }}
            >
              <Icon icon={SEVERITY_ICONS[issue.severity]} size={14} />
              {SEVERITY_LABELS[issue.severity]}
            </span>
            <span style={{ fontSize: "var(--fs-control)", color: "var(--text-primary)", lineHeight: 1.4 }}>
              {issue.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
