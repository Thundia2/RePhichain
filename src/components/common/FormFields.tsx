// ============================================================
// Shared Form Fields
//
// Reusable form components for the Inspector and Event Inspector.
// Extracted to avoid duplication across editor panels.
// ============================================================

import type React from "react";
import { useState, useEffect, useRef } from "react";
import type { Beat } from "../../types/chart";
import { INPUT_STYLE, SELECT_STYLE } from "./UIKit";
import { Tooltip } from "./Tooltip";

const NUMERIC_STYLE: React.CSSProperties = { ...INPUT_STYLE, fontFamily: "var(--font-mono)" };

/**
 * Safely parse a numeric input value.
 * Returns null for intermediate typing states (empty, "-", ".", "-.") so the
 * input isn't clobbered while the user is still typing (e.g. a negative number).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function safeParseNumber(v: string): number | null {
  if (v === "" || v === "-" || v === "." || v === "-.") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Small labeled input field */
export function Field({
  label,
  value,
  onChange,
  type = "number",
  step,
  disabled,
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  disabled?: boolean;
  min?: string | number;
  max?: string | number;
}) {
  const [localValue, setLocalValue] = useState(String(value));

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <input
        className="flex-1 w-0 min-w-0 px-1 py-0.5 text-xs"
        style={type === "number" ? NUMERIC_STYLE : INPUT_STYLE}
        type={type}
        step={step}
        value={localValue}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          setLocalValue(raw);
          if (type === "number") {
            const n = safeParseNumber(raw);
            if (n !== null) onChange(String(n));
          } else {
            onChange(raw);
          }
        }}
      />
    </label>
  );
}

// ============================================================
// Numeric commit policy (L8 — FormFields commit policy + parsing)
//
// resolveNumericCommit is the pure normalizer behind NumericInput's
// commit-on-blur/Enter path. Kept React/DOM-free so it is unit-testable under
// the node test env (no jsdom) — see src/__tests__/numericInput.test.ts.
//
// Why it exists: ~10 sites re-implemented `parseFloat(x) || fallback`, which
// clobbers a legitimately-typed 0 or negative (alpha→255, speed→1, BPM→120,
// x-offset/value→0, XGrid N). Routing them through NumericInput + this resolver
// makes the fallback fire ONLY when the field is empty/intermediate at commit
// time, never on a real 0/negative. grep `commitMode="blur"` for the call sites.
// ============================================================

export interface NumericCommitOptions {
  /** Lower clamp applied at commit (also forwarded to the <input min>). */
  min?: number;
  /** Upper clamp applied at commit (also forwarded to the <input max>). */
  max?: number;
  /** Truncate to an integer at commit. */
  integer?: boolean;
  /** Value committed when the field is empty/intermediate at commit time. Omit to revert instead. */
  fallback?: number;
  /** When true, a blurred-empty field resolves to "clear" (consumer drops the value, e.g. sets undefined). */
  optional?: boolean;
}

export type NumericCommit =
  | { action: "commit"; value: number }
  | { action: "clear" }
  | { action: "revert" };

function clampNumeric(n: number, opts: NumericCommitOptions): number {
  let v = opts.integer ? Math.trunc(n) : n;
  if (opts.min !== undefined) v = Math.max(opts.min, v);
  if (opts.max !== undefined) v = Math.min(opts.max, v);
  return v;
}

/**
 * Resolve what a numeric field should do when it commits (blur / Enter).
 * Pure — no React, no DOM — so it can be exercised directly in the node test env.
 *
 * - A parseable number (INCLUDING 0 and negatives) → clamp + commit it.
 * - Empty + `optional` → clear (the consumer maps this to undefined).
 * - Empty/intermediate ("-", ".") + `fallback` → commit the clamped fallback.
 * - Otherwise → revert to the current external value.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveNumericCommit(raw: string, opts: NumericCommitOptions = {}): NumericCommit {
  const trimmed = raw.trim();
  const parsed = safeParseNumber(trimmed);
  if (parsed !== null) {
    return { action: "commit", value: clampNumeric(parsed, opts) };
  }
  if (trimmed === "" && opts.optional) return { action: "clear" };
  if (opts.fallback !== undefined) return { action: "commit", value: clampNumeric(opts.fallback, opts) };
  return { action: "revert" };
}

/**
 * Standalone numeric input that handles intermediate typing states correctly.
 * Uses local string state so the user can type "-", "0.", "-." etc. without the
 * input being clobbered by React's controlled value, and never coerces a typed
 * 0/negative to a fallback while typing.
 *
 * commitMode:
 *  - "change" (default — back-compat): commits every valid keystroke via onChange,
 *    exactly like the original component. min/max/integer/fallback do NOT gate this
 *    path (they only apply on blur), so existing consumers are unchanged.
 *  - "blur" (L8): commits on blur/Enter through resolveNumericCommit (clamp +
 *    integer + fallback), reverts on Escape, and — when `optional` — clears via
 *    onEmpty when blurred empty. Used by the ~10 routed sites (grep commitMode="blur").
 */
export function NumericInput({
  value,
  onChange,
  onEmpty,
  commitMode = "change",
  fallback,
  optional,
  integer,
  step,
  min,
  max,
  style,
  className,
  placeholder,
  disabled,
  title,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  /** Called instead of onChange when `optional` and the field is committed empty. */
  onEmpty?: () => void;
  commitMode?: "change" | "blur";
  fallback?: number;
  optional?: boolean;
  integer?: boolean;
  step?: string | number;
  min?: number;
  max?: number;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}) {
  const [localValue, setLocalValue] = useState(value == null ? "" : String(value));
  // Set on Escape so the blur it triggers reverts instead of committing.
  const skipCommitRef = useRef(false);

  // Sync external value → local when the prop changes from outside
  // (adjusted during render, so there is no stale frame).
  const [syncedValue, setSyncedValue] = useState(value);
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value);
    setLocalValue(value == null ? "" : String(value));
  }

  const commit = () => {
    const result = resolveNumericCommit(localValue, { min, max, integer, fallback, optional });
    if (result.action === "commit") {
      onChange(result.value);
      setLocalValue(String(result.value));
    } else if (result.action === "clear") {
      onEmpty?.();
      setLocalValue("");
    } else {
      setLocalValue(value == null ? "" : String(value));
    }
  };

  const input = (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel ?? title}
      value={localValue}
      style={style}
      className={className}
      onChange={(e) => {
        const raw = e.target.value;
        // Always preserve intermediate characters ("-", ".", "-.") locally.
        setLocalValue(raw);
        if (commitMode === "change") {
          // Legacy live-commit: push only valid numbers, never clobber 0/negatives.
          const n = safeParseNumber(raw);
          if (n !== null) onChange(n);
        }
      }}
      onFocus={onFocus}
      onBlur={(e) => {
        if (commitMode === "blur") {
          if (skipCommitRef.current) skipCommitRef.current = false;
          else commit();
        }
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (commitMode !== "blur") return;
        if (e.key === "Enter") {
          e.currentTarget.blur(); // commit via onBlur
        } else if (e.key === "Escape") {
          skipCommitRef.current = true;
          setLocalValue(value == null ? "" : String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
  // `title` names the field and shows as the shared tooltip.
  return title ? <Tooltip content={title}>{input}</Tooltip> : input;
}
/** Lets a CardRow pass its label down as this field's accessible name. */
NumericInput.labelable = true;

/** Select dropdown field */
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <select
        className="flex-1 w-0 min-w-0 px-1 py-0.5 text-xs"
        style={SELECT_STYLE}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Beat input field with [whole, numerator/denominator] */
export function BeatField({
  label,
  beat,
  onChange,
}: {
  label: string;
  beat: Beat;
  onChange: (b: Beat) => void;
}) {
  const [localWhole, setLocalWhole] = useState(String(beat[0]));
  const [localNum, setLocalNum] = useState(String(beat[1]));
  const [localDen, setLocalDen] = useState(String(beat[2]));

  const beatWhole = beat[0];
  const beatNum = beat[1];
  const beatDen = beat[2];
  useEffect(() => { setLocalWhole(String(beatWhole)); }, [beatWhole]);
  useEffect(() => { setLocalNum(String(beatNum)); }, [beatNum]);
  useEffect(() => { setLocalDen(String(beatDen)); }, [beatDen]);

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-16 text-right flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <div className="flex gap-1 flex-1">
        <Tooltip content="Whole beats">
          <input
            className="w-10 px-1 py-0.5 text-xs text-center"
            style={NUMERIC_STYLE}
            type="number"
            value={localWhole}
            onChange={(e) => { setLocalWhole(e.target.value); const n = safeParseNumber(e.target.value); if (n !== null) onChange([Math.trunc(n), beat[1], beat[2]]); }}
            aria-label={`${label}: whole beats`}
          />
        </Tooltip>
        <Tooltip content="Numerator">
          <input
            className="w-10 px-1 py-0.5 text-xs text-center"
            style={NUMERIC_STYLE}
            type="number"
            min={0}
            value={localNum}
            onChange={(e) => { setLocalNum(e.target.value); const n = safeParseNumber(e.target.value); if (n !== null) onChange([beat[0], Math.trunc(n), beat[2]]); }}
            aria-label={`${label}: numerator`}
          />
        </Tooltip>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <Tooltip content="Denominator">
          <input
            className="w-10 px-1 py-0.5 text-xs text-center"
            style={NUMERIC_STYLE}
            type="number"
            min={1}
            value={localDen}
            onChange={(e) => { setLocalDen(e.target.value); const n = safeParseNumber(e.target.value); if (n !== null) onChange([beat[0], beat[1], Math.max(1, Math.trunc(n))]); }}
            aria-label={`${label}: denominator`}
          />
        </Tooltip>
      </div>
    </label>
  );
}

/** Easing options list */
export const EASING_OPTIONS = [
  "linear",
  "ease_in_sine", "ease_out_sine", "ease_in_out_sine",
  "ease_in_quad", "ease_out_quad", "ease_in_out_quad",
  "ease_in_cubic", "ease_out_cubic", "ease_in_out_cubic",
  "ease_in_quart", "ease_out_quart", "ease_in_out_quart",
  "ease_in_quint", "ease_out_quint", "ease_in_out_quint",
  "ease_in_expo", "ease_out_expo", "ease_in_out_expo",
  "ease_in_circ", "ease_out_circ", "ease_in_out_circ",
  "ease_in_back", "ease_out_back", "ease_in_out_back",
  "ease_in_elastic", "ease_out_elastic", "ease_in_out_elastic",
  "ease_in_bounce", "ease_out_bounce", "ease_in_out_bounce",
].map((e) => ({ value: e, label: e.replace(/_/g, " ") }));
