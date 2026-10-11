// ============================================================
// Horizontal scroller affordance: fades the edge that has more
// content past it, and lets a vertical mouse wheel scroll sideways.
//
//   const ref = useRef<HTMLDivElement>(null);
//   useScrollFade(ref);
//   <div ref={ref} className="ui-scroll-x">…</div>
//
// The fade is a CSS mask driven by data-fade="start|end|both"
// (see .ui-scroll-x in index.css), set without re-rendering.
// ============================================================

import { useEffect, type RefObject } from "react";

export function useScrollFade(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft < max - 1;
      const fade = start && end ? "both" : start ? "start" : end ? "end" : "";
      if (fade) el.dataset.fade = fade;
      else delete el.dataset.fade;
    };
    const onWheel = (e: WheelEvent) => {
      // Trackpads already scroll sideways; only map a plain vertical wheel.
      if (e.deltaX !== 0 || e.deltaY === 0 || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    // Tabs come and go (AI tab, mode switches) without a size change.
    const mutate = new MutationObserver(update);
    mutate.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
      resize.disconnect();
      mutate.disconnect();
    };
  }, [ref]);
}
