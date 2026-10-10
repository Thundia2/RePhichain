# Renderer smoke test

Repeatable, headless validation of the Canvas2D + Pixi renderers against a **real
RPE chart** — the live-app counterpart to the unit tests (`rendererMath.test.ts`,
`officialFormat.test.ts`), which only cover pure math. Use it to re-validate the
Wave-2/3 renderer + Pixi fixes (L4 defaults, C-series, X1/X2/Q-series) and the
L4 regression gate after any renderer/evaluator change.

Harness: [`src/dev/smokeHarness.ts`](../src/dev/smokeHarness.ts) installs
`window.__smoke` in DEV builds (tree-shaken from production). It replicates
`importChart.ts`'s post-parse store sequence, so it exercises the same code path
the app uses — minus the file picker.

## 1. Stage a chart fixture (one-time, per chart)

Chart binaries are **not committed** (`public/test-charts/` is gitignored). Drop a
Phira-style chart folder there — it must contain `info.yml` (with `chart:`,
`music:`, `illustration:` pointers), the chart JSON, audio, illustration, and any
`extra.json` / line-texture PNGs / font the chart references:

```
public/test-charts/solarflare/
  info.yml  8033315802054957.json  8033315802054957.mp3  8033315802054957.png
  extra.json  baie.png  fenfeng.png  lunhui.jpg  Exo-Regular.otf
```

(Solarflare — folder `51450` in the Phira download set — is the recommended stress
fixture: 47 lines, 1918 notes, 36 shader effects, custom font + line textures.)

## 2. Run it

Start the dev server with the preview tooling (`preview_start "vite-dev"`, port
**5174**), then drive it from `preview_eval` (or the browser devtools console):

```js
// Load Solarflare into the live unified editor.
await window.__smoke.loadChartFromUrl("/test-charts/solarflare", { fontFile: "Exo-Regular.otf" });

// Scrub to the densest section (no playback needed — drives the render `time`).
window.__smoke.seek(170);            // screenshot → dense notes/holds/lines/text/effects

// Flip to the GPU renderer (remounts the canvas) and screenshot again for parity.
await window.__smoke.setPixi(true);  // X1: must NOT freeze with shader effects
await window.__smoke.setPixi(false); // back to Canvas2D
```

`loadChartFromUrl` returns a `SmokeReport` (`{ lines, notes, effects, isLoaded,
log[] }`); every load stage is wrapped, so a missing font/texture still loads the
chart and shows up in `report.log`.

## 3. Validate (the checklist)

Screenshot Canvas2D and Pixi at beat 0 and a dense section, check the console for
errors, and confirm:

- **L4 gate** — default lines are visible (no all-invisible regression); the
  alpha-0 invisible-line technique still hides only that line, not its notes (X2).
- **Notes / holds** render with per-note alpha (C2) and correct tap-vs-hold texture
  (Q4); textured lines show their image (Q2/Q8).
- **Rotation / multiple lines** — parented/rotated lines land in the right place
  (C3/N2/UC6); **text events** render (custom font if present).
- **Effects** — shader effects apply without console errors (X1 in Pixi mode).
- **Parity** — Canvas2D and Pixi produce the same scene.
- **Playback** — `__audioStore.getState().play()` advances the combo (hit-detect
  → C1 spawn path) and stays smooth.

Console must be clean (`preview_console_logs level:"error"`).

## Notes

- **Video backgrounds (C5)** render in the classic **GamePreview** (Canvas2D, chart
  mosaic view) from `extraConfig.videos` — not the unified editor. Use a
  video-configured chart (e.g. Phira `53897`) to exercise it.
- **rAF throttling**: a backgrounded preview tab throttles `requestAnimationFrame`,
  so don't `await` an rAF promise (it hangs). `seek` + screenshot works because the
  screenshot forces a paint.
- The harness loads RPE charts only (the format these fixtures use); extend
  `smokeHarness.ts` for PEC/Official if needed.
