// ============================================================
// Group persistence round-trip (finding S1, critical)
//
// Locks loadGroupsJson against the regression that wiped ALL groups on every .pez
// re-import: the validity filter required an `Array.isArray(g.members)` field that
// the serialized shape never has (groups are {type, lines|notes}). These tests
// feed loadGroupsJson the EXACT output of getGroupsJson and assert the groups
// survive — so a future edit that reintroduces a phantom-field filter fails here.
//
// grep loadGroupsJson / migrateGroup.
// ============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { useGroupStore } from "../stores/groupStore";

// New-format groups, exactly as getGroupsJson (JSON.stringify(groups)) emits them.
function lineGroup(id: string) {
  return {
    id, type: "line", name: "LG", color: "#ffffff",
    startBeat: [0, 0, 1], endBeat: [999, 0, 1], locked: false, delay: 0,
    advancedDelay: false, lines: [{ lineIndex: 0, lineName: "L0" }],
    visibleEventKinds: ["x", "y", "rotation"],
  };
}
function noteGroup(id: string) {
  return {
    id, type: "note", name: "NG", color: "#abcdef",
    startBeat: [0, 0, 1], endBeat: [16, 0, 1], locked: false, delay: 0,
    advancedDelay: false, notes: [{ noteUid: "u1", lineIndex: 0 }],
  };
}

describe("groupStore.loadGroupsJson — groups survive a .pez round-trip (S1)", () => {
  beforeEach(() => {
    useGroupStore.getState().clearGroups();
  });

  it("keeps new-format line + note groups (the members-filter regression)", () => {
    useGroupStore.getState().loadGroupsJson(JSON.stringify([lineGroup("g1"), noteGroup("g2")]));
    const groups = useGroupStore.getState().groups;
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.id).sort()).toEqual(["g1", "g2"]);
    expect(groups.find((g) => g.id === "g1")?.type).toBe("line");
    expect(groups.find((g) => g.id === "g2")?.type).toBe("note");
  });

  it("round-trips through getGroupsJson → loadGroupsJson", () => {
    useGroupStore.getState().loadGroupsJson(JSON.stringify([lineGroup("g1"), noteGroup("g2")]));
    const serialized = useGroupStore.getState().getGroupsJson();
    useGroupStore.getState().clearGroups();
    expect(useGroupStore.getState().groups).toHaveLength(0);

    useGroupStore.getState().loadGroupsJson(serialized);
    expect(useGroupStore.getState().groups).toHaveLength(2);
  });

  it("migrates legacy v1 groups (no `type`, has a lines array)", () => {
    const legacy = {
      id: "g1", name: "Legacy", color: "#ffffff",
      startBeat: [0, 0, 1], endBeat: [4, 0, 1],
      lines: [{ lineIndex: 2, lineName: "L2" }],
    };
    useGroupStore.getState().loadGroupsJson(JSON.stringify([legacy]));
    const groups = useGroupStore.getState().groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("line");
  });

  it("drops genuinely corrupt entries (no id) but keeps valid siblings", () => {
    const json = JSON.stringify([{ name: "no id", type: "line", lines: [] }, lineGroup("g1")]);
    useGroupStore.getState().loadGroupsJson(json);
    const groups = useGroupStore.getState().groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("g1");
  });

  it("ignores non-array / malformed JSON without throwing", () => {
    useGroupStore.getState().loadGroupsJson("{}");
    expect(useGroupStore.getState().groups).toHaveLength(0);
    useGroupStore.getState().loadGroupsJson("not json");
    expect(useGroupStore.getState().groups).toHaveLength(0);
  });
});
