// ============================================================
// Pop-out Curve Editor — window.open wrapper
//
// Opens the CurveGraph in a separate browser window via
// React portal. Zustand stores are shared (same JS context).
// ============================================================

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useEditorStore } from "../../stores/editorStore";
import { CurveGraph } from "./CurveGraph";
import { chromeTheme } from "../../canvas/chromeTheme";

export function PopoutCurveEditor() {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    const win = window.open("", "phichain-curve-editor", "width=900,height=400");
    if (!win) return;
    windowRef.current = win;

    // Extract CSS variable rules
    const cssVarRules = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try { return Array.from(sheet.cssRules); } catch { return []; }
      })
      .filter((rule) => rule instanceof CSSStyleRule && rule.selectorText === ":root")
      .map((rule) => rule.cssText)
      .join("\n");

    // Copy inline styles
    const inlineStyles = Array.from(document.querySelectorAll("style"))
      .map((el) => el.textContent)
      .join("\n");

    win.document.head.innerHTML = `<style>${cssVarRules}\n${inlineStyles}</style>`;

    // Token values resolved from the main window (chromeTheme reads :root).
    const t = chromeTheme();
    win.document.body.style.backgroundColor = t.bgPrimary;
    win.document.body.style.margin = "0";
    win.document.body.style.overflow = "hidden";
    win.document.body.style.color = t.textPrimary;
    win.document.body.style.fontFamily = t.fontSans;
    win.document.title = "PhiChain — Curve Editor";

    const root = win.document.createElement("div");
    root.id = "curve-editor-root";
    root.style.width = "100%";
    root.style.height = "100vh";
    win.document.body.appendChild(root);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountEl(root);

    win.addEventListener("beforeunload", () => {
      useEditorStore.getState().setCurveEditorPoppedOut(false);
    });

    return () => {
      setMountEl(null);
      win.close();
    };
  }, []);

  if (!mountEl) return null;

  return createPortal(<CurveGraph isPopout />, mountEl);
}
