// ============================================================
// FormFields numeric commit policy (finding L8)
//
// Locks resolveNumericCommit — the pure normalizer behind NumericInput's
// commit-on-blur path. The headline contract: a typed 0 / negative is NEVER
// clobbered to a fallback (the bug class L8 kills: alpha→255, speed→1, BPM→120,
// x-offset/value→0, XGrid N). The fallback fires ONLY on an empty/intermediate
// field at commit time. Also covers clamp (min/max), integer trunc, and the
// optional→clear path used by ChartSettings' Phira fields.
//
// Pure (no DOM) so it runs under the node test env (no jsdom). grep resolveNumericCommit.
// ============================================================

import { describe, it, expect } from "vitest";
import { resolveNumericCommit, safeParseNumber } from "../components/common/FormFields";

describe("resolveNumericCommit — falsy-zero / negative preservation (L8)", () => {
  it("commits a typed 0 instead of the fallback (the alpha/BPM/value clobber)", () => {
    expect(resolveNumericCommit("0", { fallback: 255 })).toEqual({ action: "commit", value: 0 });
    expect(resolveNumericCommit("0", { fallback: 120 })).toEqual({ action: "commit", value: 0 });
  });

  it("commits a typed negative instead of the fallback (x-offset / reverse speed)", () => {
    expect(resolveNumericCommit("-5", { fallback: 0 })).toEqual({ action: "commit", value: -5 });
    expect(resolveNumericCommit("-0.5", {})).toEqual({ action: "commit", value: -0.5 });
  });

  it("commits a plain number untouched when no constraints apply", () => {
    expect(resolveNumericCommit("12.5", {})).toEqual({ action: "commit", value: 12.5 });
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(resolveNumericCommit("  7 ", {})).toEqual({ action: "commit", value: 7 });
  });
});

describe("resolveNumericCommit — empty / intermediate handling (L8)", () => {
  it("uses the fallback only when the field is empty", () => {
    expect(resolveNumericCommit("", { fallback: 120 })).toEqual({ action: "commit", value: 120 });
  });

  it("uses the fallback for an intermediate string with no committable number", () => {
    // "-" / "." are mid-typing states; with a fallback we normalise to it on commit.
    expect(resolveNumericCommit("-", { fallback: 0 })).toEqual({ action: "commit", value: 0 });
    expect(resolveNumericCommit(".", { fallback: 4 })).toEqual({ action: "commit", value: 4 });
  });

  it("reverts when empty/intermediate and no fallback is given", () => {
    expect(resolveNumericCommit("", {})).toEqual({ action: "revert" });
    expect(resolveNumericCommit("-", {})).toEqual({ action: "revert" });
    expect(resolveNumericCommit("-.", {})).toEqual({ action: "revert" });
  });

  it("reverts on genuinely unparseable input (no fallback)", () => {
    expect(resolveNumericCommit("abc", {})).toEqual({ action: "revert" });
  });

  it("clears (not reverts) when optional and blurred empty", () => {
    expect(resolveNumericCommit("", { optional: true })).toEqual({ action: "clear" });
  });

  it("optional + intermediate (non-empty) reverts rather than clearing", () => {
    expect(resolveNumericCommit("-", { optional: true })).toEqual({ action: "revert" });
  });
});

describe("resolveNumericCommit — clamp / integer normalisation (L8)", () => {
  it("clamps to max (XGrid N ≤ 256)", () => {
    expect(resolveNumericCommit("300", { min: 2, max: 256, integer: true })).toEqual({ action: "commit", value: 256 });
  });

  it("clamps to min (BPM non-positive guard: 0 → 1)", () => {
    expect(resolveNumericCommit("0", { min: 1 })).toEqual({ action: "commit", value: 1 });
    expect(resolveNumericCommit("-4", { min: 1 })).toEqual({ action: "commit", value: 1 });
  });

  it("truncates to an integer when requested", () => {
    expect(resolveNumericCommit("3.7", { integer: true })).toEqual({ action: "commit", value: 3 });
    expect(resolveNumericCommit("-3.7", { integer: true })).toEqual({ action: "commit", value: -3 });
  });

  it("clamps the fallback too (empty field still respects bounds)", () => {
    expect(resolveNumericCommit("", { fallback: 300, max: 256 })).toEqual({ action: "commit", value: 256 });
  });

  it("clamps to a range (XGrid below min)", () => {
    expect(resolveNumericCommit("1", { min: 2, max: 256, integer: true })).toEqual({ action: "commit", value: 2 });
  });
});

describe("safeParseNumber — intermediate typing states (unchanged contract)", () => {
  it("returns null for the intermediate states that must not clobber the input", () => {
    expect(safeParseNumber("")).toBeNull();
    expect(safeParseNumber("-")).toBeNull();
    expect(safeParseNumber(".")).toBeNull();
    expect(safeParseNumber("-.")).toBeNull();
    expect(safeParseNumber("abc")).toBeNull();
  });

  it("parses real numbers including 0 and negatives", () => {
    expect(safeParseNumber("0")).toBe(0);
    expect(safeParseNumber("-5")).toBe(-5);
    expect(safeParseNumber("1.5")).toBe(1.5);
  });
});
