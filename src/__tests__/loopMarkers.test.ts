// ============================================================
// audioStore loop-marker normalization (finding H7)
//
// The [ / ] hotkeys set the A/B loop markers at the playhead and can be pressed
// out of order. An inverted (start > end) or zero-length region used to render
// backwards and — without the engine tick's start<end guard — freeze playback by
// seeking back to a point at/after loopEnd every frame. setLoopStart/setLoopEnd
// now normalize the region to ordered (swapping when a marker is set past the
// other), so the stored region is always valid. grep loopStartBeat / H7.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "../stores/audioStore";

describe("audioStore loop markers — normalization (H7)", () => {
  beforeEach(() => {
    useAudioStore.getState().clearLoop();
  });

  it("keeps an ordered region when set in order", () => {
    useAudioStore.getState().setLoopStart(4);
    useAudioStore.getState().setLoopEnd(8);
    expect(useAudioStore.getState().loopStartBeat).toBe(4);
    expect(useAudioStore.getState().loopEndBeat).toBe(8);
  });

  it("swaps when the start is set past the existing end", () => {
    useAudioStore.getState().setLoopEnd(8);
    useAudioStore.getState().setLoopStart(12); // past end → swap to keep ordered
    expect(useAudioStore.getState().loopStartBeat).toBe(8);
    expect(useAudioStore.getState().loopEndBeat).toBe(12);
  });

  it("swaps when the end is set before the existing start", () => {
    useAudioStore.getState().setLoopStart(8);
    useAudioStore.getState().setLoopEnd(4); // before start → swap to keep ordered
    expect(useAudioStore.getState().loopStartBeat).toBe(4);
    expect(useAudioStore.getState().loopEndBeat).toBe(8);
  });

  it("never produces an inverted region across either setter", () => {
    useAudioStore.getState().setLoopStart(10);
    useAudioStore.getState().setLoopEnd(2);
    const { loopStartBeat: s1, loopEndBeat: e1 } = useAudioStore.getState();
    expect(s1! <= e1!).toBe(true);

    useAudioStore.getState().clearLoop();
    useAudioStore.getState().setLoopEnd(3);
    useAudioStore.getState().setLoopStart(20);
    const { loopStartBeat: s2, loopEndBeat: e2 } = useAudioStore.getState();
    expect(s2! <= e2!).toBe(true);
  });

  it("clears a marker to null without swapping the other", () => {
    useAudioStore.getState().setLoopStart(4);
    useAudioStore.getState().setLoopEnd(8);
    useAudioStore.getState().setLoopStart(null);
    expect(useAudioStore.getState().loopStartBeat).toBeNull();
    expect(useAudioStore.getState().loopEndBeat).toBe(8);
  });
});
