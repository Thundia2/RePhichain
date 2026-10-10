// ============================================================
// Canvas Context Menu — Right-click menu on Unified Canvas
//
// Quick event creation: set X/Y at clicked position, set
// rotation/opacity with numeric input (PromptDialog), create
// transitions. Styled with the ui-popover / ui-menu-item classes.
// ============================================================

import type { LucideIcon } from "lucide-react";
import { Blend, Move, MoveHorizontal, MoveVertical, RotateCw, Spline } from "lucide-react";
import { createQuickConstant, createQuickTransition } from "../../utils/quickEventCreate";
import { showPrompt } from "../common/PromptDialog";
import { Icon } from "../common/Icon";

interface CanvasContextMenuProps {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  beat: number;
  lineIndex: number;
  onClose: () => void;
}

/** null when `v` parses as a finite number, otherwise an error message. */
function validateNumber(v: string): string | null {
  if (v.trim() === "" || !Number.isFinite(Number(v))) return "Enter a number";
  return null;
}

function validateOpacity(v: string): string | null {
  const err = validateNumber(v);
  if (err) return err;
  const n = Number(v);
  if (n < 0 || n > 255) return "Enter a value from 0 to 255";
  return null;
}

export function CanvasContextMenu({
  x,
  y,
  canvasX,
  canvasY,
  beat,
  lineIndex,
  onClose,
}: CanvasContextMenuProps) {
  const beatLabel = beat.toFixed(2);

  const menuWidth = 240;
  const menuHeight = 220;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  const handleSetXY = () => {
    createQuickConstant(lineIndex, "x", beat, canvasX);
    createQuickConstant(lineIndex, "y", beat, canvasY);
    onClose();
  };

  const handleSetX = () => {
    createQuickConstant(lineIndex, "x", beat, canvasX);
    onClose();
  };

  const handleSetY = () => {
    createQuickConstant(lineIndex, "y", beat, canvasY);
    onClose();
  };

  // The menu closes first; the prompt dialog then asks for the value.
  const handleSetRotation = async () => {
    onClose();
    const val = await showPrompt({
      title: "Set rotation",
      label: `Rotation in degrees at beat ${beatLabel}`,
      defaultValue: "0",
      inputMode: "decimal",
      validate: validateNumber,
    });
    if (val !== null) {
      createQuickConstant(lineIndex, "rotation", beat, parseFloat(val) || 0);
    }
  };

  const handleSetOpacity = async () => {
    onClose();
    const val = await showPrompt({
      title: "Set opacity",
      label: `Opacity (0–255) at beat ${beatLabel}`,
      defaultValue: "255",
      inputMode: "decimal",
      validate: validateOpacity,
    });
    if (val !== null) {
      createQuickConstant(lineIndex, "opacity", beat, Math.max(0, Math.min(255, parseInt(val) || 0)));
    }
  };

  const handleTransitionToHere = () => {
    createQuickTransition(lineIndex, "x", canvasX);
    createQuickTransition(lineIndex, "y", canvasY);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: "calc(var(--z-dropdown) - 1)" }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* Menu */}
      <div
        role="menu"
        aria-label="Canvas actions"
        className="ui-popover"
        style={{
          position: "fixed",
          left: clampedX,
          top: clampedY,
          zIndex: "var(--z-dropdown)",
          minWidth: menuWidth,
        }}
      >
        <CtxMenuItem icon={Move} label={`Set X/Y at beat ${beatLabel}`} onClick={handleSetXY} />
        <CtxMenuItem icon={MoveHorizontal} label={`Set X at beat ${beatLabel}`} onClick={handleSetX} />
        <CtxMenuItem icon={MoveVertical} label={`Set Y at beat ${beatLabel}`} onClick={handleSetY} />
        <CtxMenuSeparator />
        <CtxMenuItem icon={RotateCw} label={`Set rotation at beat ${beatLabel}…`} onClick={handleSetRotation} />
        <CtxMenuItem icon={Blend} label={`Set opacity at beat ${beatLabel}…`} onClick={handleSetOpacity} />
        <CtxMenuSeparator />
        <CtxMenuItem icon={Spline} label="Create transition to here" onClick={handleTransitionToHere} />
      </div>
    </>
  );
}

function CtxMenuItem({ icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="ui-menu-item" onClick={onClick}>
      <span style={{ display: "inline-flex", color: "var(--text-secondary)" }}>
        <Icon icon={icon} />
      </span>
      {label}
    </button>
  );
}

function CtxMenuSeparator() {
  return <div role="separator" className="ui-menu-separator" />;
}
