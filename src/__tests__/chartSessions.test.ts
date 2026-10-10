// ============================================================
// Session-owns-state (finding L5)
//
// Locks the three mechanisms L5 introduced:
//   1. tabStore routing — satellite tabs (panels / line-events / per-line
//      unrolled) resolve to the ACTIVE chart session instead of a "current"
//      sentinel, so two charts' satellites can't collide (the H2 overwrite).
//   2. loadFromProjectData resets per-project state (extraConfig + illustration
//      + groups + bookmarks) so an import never inherits the previous project
//      (finding S8). Group/bookmark clearing goes through the registered reset
//      hooks (importing those stores here registers them).
//   3. A session round-trip preserves the per-chart fields the old hand-list
//      leaked (extraConfig / lineTextures / chartFontFamily / multi-line
//      selection / bookmark selection + undo stacks), so a tab switch isolates
//      one chart's state from another.
//
// grep sessionOwnerTabId / registerProjectLoadReset / saveActiveChartSession.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  isChartSessionTabId,
  sessionOwnerTabId,
  chartGroupKey,
  getActiveChartSessionTabId,
  setActiveChartSessionTabId,
  useTabStore,
} from "../stores/tabStore";
import { useChartStore } from "../stores/chartStore";
import { useEditorStore } from "../stores/editorStore";
import { useAudioStore } from "../stores/audioStore";
import { useGroupStore } from "../stores/groupStore";
import { useBookmarkStore } from "../stores/bookmarkStore";
import { saveSession, restoreSession, deleteSession } from "../utils/chartSessions";
import type { PhichainChart } from "../types/chart";

function emptyChart(offset: number): PhichainChart {
  return { format: 1, offset, bpm_list: [{ beat: [0, 0, 1], bpm: 120 }], lines: [] };
}

describe("tabStore chart-session routing (L5)", () => {
  beforeEach(() => {
    useTabStore.setState({
      tabs: [
        { id: "home", type: "home", label: "Home", closable: false },
        { id: "unified:A", type: "unified_editor", label: "A", closable: true },
        { id: "unified:B", type: "unified_editor", label: "B", closable: true },
        { id: "panel:timeline", type: "panel", label: "Timeline", closable: true, data: { panelId: "timeline" } },
      ],
      activeTabId: "unified:A",
    });
    setActiveChartSessionTabId("unified:A");
  });

  it("isChartSessionTabId is true only for real-chart tab ids", () => {
    expect(isChartSessionTabId("chart:x")).toBe(true);
    expect(isChartSessionTabId("unified:x")).toBe(true);
    expect(isChartSessionTabId("unrolled:x")).toBe(true);
    // Satellites + home don't own a session. Note "unrolled-line:" must NOT
    // match the "unrolled:" prefix (the ":" vs "-" after "unrolled" matters).
    expect(isChartSessionTabId("unrolled-line:3")).toBe(false);
    expect(isChartSessionTabId("line-events:3")).toBe(false);
    expect(isChartSessionTabId("panel:timeline")).toBe(false);
    expect(isChartSessionTabId("home")).toBe(false);
  });

  it("chartGroupKey strips the prefix for real-chart tabs, preserving inner colons", () => {
    expect(chartGroupKey("chart:A")).toBe("A");
    expect(chartGroupKey("unified:A")).toBe("A");
    expect(chartGroupKey("unrolled:rpe-import:xyz")).toBe("rpe-import:xyz");
    expect(chartGroupKey("home")).toBe(null);
  });

  it("satellite tabs resolve to the ACTIVE chart — no 'current' sentinel", () => {
    expect(sessionOwnerTabId("panel:timeline")).toBe("unified:A");
    expect(chartGroupKey("panel:timeline")).toBe("A");
    expect(sessionOwnerTabId("line-events:2")).toBe("unified:A");
    expect(sessionOwnerTabId("unrolled-line:2")).toBe("unified:A");

    // Switch the active chart → every satellite follows it (the fix for H2:
    // before, all satellites were the constant "current", so a panel save
    // could land on whichever chart tab happened to be positionally last).
    setActiveChartSessionTabId("unified:B");
    expect(chartGroupKey("panel:timeline")).toBe("B");
    expect(sessionOwnerTabId("unrolled-line:2")).toBe("unified:B");
  });

  it("getActiveChartSessionTabId falls back when the tracked tab was closed", () => {
    setActiveChartSessionTabId("unified:GONE"); // not present in tabs
    expect(getActiveChartSessionTabId()).toBe("unified:A"); // first chart tab present
  });

  it("a view and a satellite of the same chart share a group key (App skips clone)", () => {
    expect(chartGroupKey("unified:A")).toBe(chartGroupKey("panel:timeline"));
    expect(chartGroupKey("unified:A")).not.toBe(chartGroupKey("unified:B"));
  });
});

describe("loadFromProjectData resets per-project state (L5 / S8)", () => {
  it("clears extraConfig, illustration, groups, and bookmarks on load", () => {
    // Seed an outgoing project: effects, an illustration ref, a group in edit
    // mode, and a selected bookmark.
    const cs = useChartStore.getState();
    cs.setExtraConfig({ effects: [{ start: [0, 0, 1], end: [1, 0, 1], shader: "noise" }], videos: [] });
    useChartStore.setState({ illustrationImage: {} as unknown as HTMLImageElement, isLoaded: true });
    const gid = useGroupStore.getState().createLineGroup("G", [0, 0, 1], [4, 0, 1]);
    useGroupStore.getState().enterGroupEditMode(gid);
    const bid = useBookmarkStore.getState().addBookmark([0, 0, 1], 0, true, 0, "tap");
    useBookmarkStore.getState().selectBookmark(bid);

    // Load a fresh project carrying none of those.
    useChartStore.getState().loadFromProjectData({
      chart_json: JSON.stringify(emptyChart(0)),
      meta: { composer: "", charter: "", illustrator: "", name: "New", level: "" },
      project_path: "p",
      music_path: null,
      illustration_path: null,
    });

    const after = useChartStore.getState();
    expect(after.extraConfig.effects).toEqual([]); // reset to default, not inherited
    expect(after.illustrationImage).toBe(null); // cleared
    expect(useGroupStore.getState().groups).toEqual([]); // cleared via registered hook
    expect(useGroupStore.getState().activeGroupId).toBe(null);
    expect(useBookmarkStore.getState().bookmarks).toEqual([]); // cleared via registered hook
    expect(useBookmarkStore.getState().selectedBookmarkIds).toEqual([]);
  });
});

describe("session round-trip isolates per-chart state (L5)", () => {
  beforeEach(() => {
    useAudioStore.setState({ isPlaying: false, musicLoaded: false, currentTime: 0 });
    deleteSession("chart:A");
    deleteSession("chart:B");
  });

  it("preserves extraConfig / textures / font / multi-select / bookmark sel + undo per tab", async () => {
    // ── Chart A ──
    useChartStore.setState({ chart: emptyChart(1), isLoaded: true });
    useChartStore.getState().setExtraConfig({ effects: [{ start: [0, 0, 1], end: [1, 0, 1], shader: "noise" }], videos: [] });
    useChartStore.getState().setChartFontFamily("FontA");
    useChartStore.getState().setLineTexture("texA", new Blob(["a"]));
    useEditorStore.getState().setMultiSelectedLines(["L1", "L2"]);
    // Seed a bookmark selection + a one-entry undo stack (seq 7).
    useBookmarkStore.setState({
      bookmarks: [], selectedBookmarkIds: ["bkA"],
      _past: [[]], _pastSeqs: [7], _future: [], _futureSeqs: [],
    });
    saveSession("chart:A");

    // ── Mutate everything to a different "Chart B" state ──
    useChartStore.setState({ chart: emptyChart(2), chartFontFamily: null, lineTextures: new Map() });
    useChartStore.getState().setExtraConfig({ effects: [], videos: [] });
    useEditorStore.getState().setMultiSelectedLines([]);
    useBookmarkStore.setState({ selectedBookmarkIds: [], _past: [], _pastSeqs: [] });
    saveSession("chart:B");

    // ── Restore A: every per-chart field comes back, none leaked from B ──
    await restoreSession("chart:A");
    const cs = useChartStore.getState();
    expect(cs.chart.offset).toBe(1);
    expect(cs.chartFontFamily).toBe("FontA");
    expect(cs.extraConfig.effects ?? []).toHaveLength(1);
    expect(cs.lineTextures.has("texA")).toBe(true);
    expect(useEditorStore.getState().multiSelectedLineIds).toEqual(["L1", "L2"]);
    expect(useBookmarkStore.getState().selectedBookmarkIds).toEqual(["bkA"]);
    expect(useBookmarkStore.getState()._pastSeqs).toEqual([7]);

    deleteSession("chart:A");
    deleteSession("chart:B");
  });
});
