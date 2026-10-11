// ============================================================
// Keyboard behaviour shared by every role="menu" popover
// (menu bar dropdowns and right-click menus):
//
//   Escape          closes the menu and puts focus back
//   ↓ / ↑           next / previous enabled item (wraps)
//   Home / End      first / last enabled item
//   (optional)      a press outside the menu closes it
//
// The listener runs in the window capture phase and stops these keys
// there, so while a menu is open they never reach the editor hotkeys
// (arrow keys would otherwise move the selected notes).
//
//   const menuRef = useRef<HTMLDivElement>(null);
//   useMenuKeyboard(open, onClose, menuRef, { focusFirst: true });
//   <div ref={menuRef} role="menu">…</div>
// ============================================================

import { useEffect, useRef, type RefObject } from "react";

const ITEM_SELECTOR = '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])';

export interface MenuKeyboardOptions {
  /** Focus the first enabled item when the menu opens (right-click menus). */
  focusFirst?: boolean;
  /** Where focus goes on Escape. Defaults to whatever was focused when the menu opened. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** Also close on a pointer press outside the menu (for menus without a backdrop). */
  closeOnOutsidePress?: boolean;
}

/** Move focus among a menu's enabled items. */
export function focusMenuItem(menu: HTMLElement | null, to: 1 | -1 | "first" | "last"): void {
  const items = Array.from(menu?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
  if (items.length === 0) return;
  const i = items.indexOf(menu?.ownerDocument.activeElement as HTMLElement);
  const next =
    to === "first" ? 0
    : to === "last" ? items.length - 1
    : i === -1 ? (to === 1 ? 0 : items.length - 1)
    : (i + to + items.length) % items.length;
  items[next].focus();
}

const MOVES: Record<string, 1 | -1 | "first" | "last"> = {
  ArrowDown: 1,
  ArrowUp: -1,
  Home: "first",
  End: "last",
};

export function useMenuKeyboard(
  open: boolean,
  onClose: () => void,
  menuRef: RefObject<HTMLElement | null>,
  { focusFirst = false, returnFocusTo, closeOnOutsidePress = false }: MenuKeyboardOptions = {},
): void {
  // Latest onClose without re-subscribing on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    // The menu's own window: it may be portalled into a pop-out.
    const win = menuRef.current?.ownerDocument.defaultView ?? window;
    const doc = win.document;
    const opener = doc.activeElement as HTMLElement | null;
    const raf = focusFirst ? requestAnimationFrame(() => focusMenuItem(menuRef.current, "first")) : 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        (returnFocusTo?.current ?? opener)?.focus?.();
        return;
      }
      const to = MOVES[e.key];
      if (to === undefined) return;
      // Only steal arrows when focus is in the menu or nowhere in particular.
      const active = doc.activeElement;
      const inMenu = !!menuRef.current?.contains(active);
      if (!inMenu && active && active !== doc.body && active !== opener) return;
      e.preventDefault();
      e.stopPropagation();
      focusMenuItem(menuRef.current, to);
    };
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onCloseRef.current();
    };
    win.addEventListener("keydown", onKey, true);
    if (closeOnOutsidePress) win.addEventListener("pointerdown", onPointer, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      win.removeEventListener("keydown", onKey, true);
      win.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open, focusFirst, menuRef, returnFocusTo, closeOnOutsidePress]);
}
