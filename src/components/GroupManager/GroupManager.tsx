// ============================================================
// Group Manager Panel — Unified group + batch editor
//
// Shows all editing groups (Line or Note), allows creating,
// managing members, and running batch operations. Replaces
// the old separate BatchEditor panel.
// ============================================================

import { useState } from "react";
import { useGroupStore } from "../../stores/groupStore";
import { useChartStore } from "../../stores/chartStore";
import { useToastStore } from "../../stores/toastStore";
import {
  useSelectedLineIndex,
  useMultiSelectedLineIndices,
  useSelectedNoteIndices,
} from "../../stores/selection";
import { floatToBeat, beatToFloat } from "../../types/chart";
import type { LineEventKind, NoteKind } from "../../types/chart";
import { safeParseNumber } from "../common/FormFields";
import { Plus, X } from "lucide-react";
import { Button } from "../common/Button";
import { IconButton } from "../common/IconButton";
import { Toggle } from "../common/UIKit";

// ---- Extracted sub-components ----
import { LineBatchOps } from "./LineBatchOps";
import { NoteBatchOps } from "./NoteBatchOps";
import { GroupRow } from "./GroupRow";
import {
  SECTION_STYLE, CARD_STYLE, ROW_STYLE, INPUT_STYLE,
} from "./groupManagerStyles";
import type { LineGroup, NoteGroup, GroupLineRef, GroupNoteRef } from "../../types/group";

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "var(--fs-caption)",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: "var(--space-2)",
};

const NUM_INPUT_STYLE: React.CSSProperties = { ...INPUT_STYLE, fontFamily: "var(--font-mono)" };

const EMPTY_STYLE: React.CSSProperties = {
  padding: "var(--space-6) var(--space-10)",
  color: "var(--text-secondary)",
  fontSize: "var(--fs-caption)",
  textAlign: "center",
};

// ============================================================
// Main Component
// ============================================================

export function GroupManager() {
  const groups = useGroupStore((s) => s.groups);
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const createLineGroup = useGroupStore((s) => s.createLineGroup);
  const createNoteGroup = useGroupStore((s) => s.createNoteGroup);
  const deleteGroup = useGroupStore((s) => s.deleteGroup);
  const renameGroup = useGroupStore((s) => s.renameGroup);
  const toggleGroupLocked = useGroupStore((s) => s.toggleGroupLocked);
  const addLineToGroup = useGroupStore((s) => s.addLineToGroup);
  const removeLineFromGroup = useGroupStore((s) => s.removeLineFromGroup);
  const addNoteToGroup = useGroupStore((s) => s.addNoteToGroup);
  const removeNoteFromGroup = useGroupStore((s) => s.removeNoteFromGroup);
  const setGroupDelay = useGroupStore((s) => s.setGroupDelay);
  const toggleAdvancedDelay = useGroupStore((s) => s.toggleAdvancedDelay);
  const setMemberDelayOverride = useGroupStore((s) => s.setMemberDelayOverride);
  const enterGroupEditMode = useGroupStore((s) => s.enterGroupEditMode);
  const exitGroupEditMode = useGroupStore((s) => s.exitGroupEditMode);

  // Batch operations
  const batchAddEvent = useGroupStore((s) => s.batchAddEventToGroup);
  const batchCopyEvents = useGroupStore((s) => s.batchCopyEventsInGroup);
  const batchDeleteEvents = useGroupStore((s) => s.batchDeleteEventsByKindInGroup);
  const batchShiftNotes = useGroupStore((s) => s.batchShiftNotesInGroup);
  const batchChangeNoteKind = useGroupStore((s) => s.batchChangeNoteKindInGroup);
  const batchFlipNotes = useGroupStore((s) => s.batchFlipNotesInGroup);
  const batchChangeNoteSpeed = useGroupStore((s) => s.batchChangeNoteSpeedInGroup);

  const chart = useChartStore((s) => s.chart);
  const selectedLineIndex = useSelectedLineIndex();
  const multiSelectedLineIndices = useMultiSelectedLineIndices();
  const selectedNoteIndices = useSelectedNoteIndices();

  const [showCreate, setShowCreate] = useState<"line" | "note" | null>(null);
  const [newName, setNewName] = useState("");
  const [newStartBeat, setNewStartBeat] = useState(0);
  const [newEndBeat, setNewEndBeat] = useState(100);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Batch event state (line groups)
  const [batchKind, setBatchKind] = useState<LineEventKind>("x");
  const [batchType, setBatchType] = useState<"constant" | "transition">("constant");
  const [batchValue, setBatchValue] = useState(0);
  const [batchEndValue, setBatchEndValue] = useState(0);
  const [batchStartBeat, setBatchStartBeat] = useState(0);
  const [batchEndBeat, setBatchEndBeat] = useState(4);
  const [copySourceLine, setCopySourceLine] = useState(0);
  const [deleteKind, setDeleteKind] = useState<LineEventKind>("x");

  // Batch note state (note groups)
  const [shiftDelta, setShiftDelta] = useState(0);
  const [noteKind, setNoteKind] = useState<NoteKind>("tap");
  const [noteSpeed, setNoteSpeed] = useState(1);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  const handleCreate = () => {
    if (!newName.trim() || !showCreate) return;
    const fn = showCreate === "line" ? createLineGroup : createNoteGroup;
    const id = fn(newName.trim(), floatToBeat(newStartBeat), floatToBeat(newEndBeat));
    setShowCreate(null);
    setNewName("");
    setSelectedGroupId(id);
  };

  const handleAddSelected = () => {
    if (!selectedGroupId || !selectedGroup || selectedGroup.type !== "line") return;
    const linesToAdd = multiSelectedLineIndices.length > 0
      ? multiSelectedLineIndices
      : selectedLineIndex !== null ? [selectedLineIndex] : [];

    let failCount = 0;
    for (const li of linesToAdd) {
      if (!addLineToGroup(selectedGroupId, li)) failCount++;
    }
    if (failCount > 0) {
      useToastStore.getState().addToast({ message: `${failCount} line(s) could not be added (timeframe overlap).`, type: "info" });
    }
  };

  const handleAddSelectedNotes = () => {
    if (!selectedGroupId || !selectedGroup || selectedGroup.type !== "note") return;
    if (selectedLineIndex === null || selectedNoteIndices.length === 0) return;
    const line = chart.lines[selectedLineIndex];
    if (!line) return;

    let failCount = 0;
    for (const ni of selectedNoteIndices) {
      const note = line.notes[ni];
      if (!note?.uid) continue;
      if (!addNoteToGroup(selectedGroupId, note.uid, selectedLineIndex)) failCount++;
    }
    if (failCount > 0) {
      useToastStore.getState().addToast({ message: `${failCount} note(s) could not be added (timeframe overlap).`, type: "info" });
    }
  };

  const handleBatchAddEvent = () => {
    if (!selectedGroupId) return;
    const value = batchType === "constant"
      ? { constant: batchValue }
      : { transition: { start: batchValue, end: batchEndValue, easing: "linear" as const } };
    batchAddEvent(selectedGroupId, batchKind, batchStartBeat, batchEndBeat, value);
  };

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "var(--space-10)", fontSize: "var(--fs-body)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-8)" }}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-headline)" }}>Groups</span>
        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <Button
            variant={showCreate === "line" ? "primary" : "secondary"}
            size="sm"
            icon={Plus}
            aria-pressed={showCreate === "line"}
            onClick={() => setShowCreate(showCreate === "line" ? null : "line")}
          >
            Line group
          </Button>
          <Button
            variant={showCreate === "note" ? "primary" : "secondary"}
            size="sm"
            icon={Plus}
            aria-pressed={showCreate === "note"}
            onClick={() => setShowCreate(showCreate === "note" ? null : "note")}
          >
            Note group
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...CARD_STYLE, padding: "var(--space-10)", marginBottom: "var(--space-10)" }}>
          <div style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-6)" }}>
            New {showCreate === "line" ? "line" : "note"} group
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Group name…"
            aria-label="Group name"
            style={{ ...INPUT_STYLE, width: "100%", marginBottom: "var(--space-6)" }}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", marginBottom: "var(--space-8)" }}>
            <div>
              <label style={LABEL_STYLE}>Start beat</label>
              <input type="number" step="1" value={newStartBeat} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setNewStartBeat(n); }} style={{ ...NUM_INPUT_STYLE, width: "100%" }} />
            </div>
            <div>
              <label style={LABEL_STYLE}>End beat</label>
              <input type="number" step="1" value={newEndBeat} onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setNewEndBeat(n); }} style={{ ...NUM_INPUT_STYLE, width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-4)" }}>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
            <Button onClick={() => setShowCreate(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Group list */}
      {groups.length === 0 && !showCreate && (
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-control)", padding: "var(--space-12) 0", textAlign: "center" }}>
          No groups yet. Create one or press Ctrl+Shift+G.
        </div>
      )}

      {groups.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          isSelected={selectedGroupId === group.id}
          isActive={activeGroupId === group.id}
          editingNameId={editingNameId}
          editingName={editingName}
          onSelect={() => setSelectedGroupId(selectedGroupId === group.id ? null : group.id)}
          onEnterEdit={() => enterGroupEditMode(group.id)}
          onExitEdit={exitGroupEditMode}
          onDelete={() => {
            deleteGroup(group.id);
            if (selectedGroupId === group.id) setSelectedGroupId(null);
          }}
          onToggleLock={() => toggleGroupLocked(group.id)}
          onStartRename={() => { setEditingNameId(group.id); setEditingName(group.name); }}
          onCommitRename={() => { renameGroup(group.id, editingName); setEditingNameId(null); }}
          onCancelRename={() => setEditingNameId(null)}
          onEditingNameChange={setEditingName}
        />
      ))}

      {/* Selected group detail panel */}
      {selectedGroup && (
        <div style={{ marginTop: "var(--space-8)" }}>

          {/* Delay Section */}
          <div style={SECTION_STYLE}>Delay</div>
          <div style={CARD_STYLE}>
            <div style={ROW_STYLE}>
              <span style={{ color: "var(--text-primary)" }}>Delay (beats)</span>
              <input
                type="number"
                step="0.25"
                value={selectedGroup.delay}
                onChange={(e) => { const n = safeParseNumber(e.target.value); if (n !== null) setGroupDelay(selectedGroup.id, n); }}
                aria-label="Delay (beats)"
                style={{ ...NUM_INPUT_STYLE, width: 70, textAlign: "center" }}
              />
            </div>
            <div style={{ ...ROW_STYLE, borderBottom: selectedGroup.advancedDelay ? undefined : "none" }}>
              <span style={{ color: "var(--text-primary)" }}>Advanced (per-member)</span>
              <Toggle
                checked={!!selectedGroup.advancedDelay}
                onChange={() => toggleAdvancedDelay(selectedGroup.id)}
                label="Advanced per-member delay"
              />
            </div>
            {selectedGroup.advancedDelay && (
              <div style={{ padding: "var(--space-4) var(--space-10) var(--space-6)", fontSize: "var(--fs-caption)", color: "var(--text-secondary)" }}>
                Override delay per member below.
              </div>
            )}
          </div>

          {/* Members Section */}
          <div style={SECTION_STYLE}>Members</div>
          <div style={CARD_STYLE}>
            <div style={{ padding: "var(--space-6) var(--space-10)", display: "flex", gap: "var(--space-4)" }}>
              {selectedGroup.type === "line" ? (
                <Button variant="primary" size="sm" block icon={Plus} onClick={handleAddSelected}>
                  Add selected lines
                </Button>
              ) : (
                <Button variant="primary" size="sm" block icon={Plus} onClick={handleAddSelectedNotes}>
                  Add selected notes
                </Button>
              )}
            </div>

            {selectedGroup.type === "line" && (selectedGroup as LineGroup).lines.length === 0 && (
              <div style={EMPTY_STYLE}>
                No lines. Select lines and click "Add selected lines".
              </div>
            )}

            {selectedGroup.type === "note" && (selectedGroup as NoteGroup).notes.length === 0 && (
              <div style={EMPTY_STYLE}>
                No notes. Select notes and click "Add selected notes".
              </div>
            )}

            {/* Line members */}
            {selectedGroup.type === "line" && (selectedGroup as LineGroup).lines.map((ref: GroupLineRef, i: number) => (
              <div key={ref.lineIndex} style={{ ...ROW_STYLE, borderBottom: i === (selectedGroup as LineGroup).lines.length - 1 ? "none" : undefined }}>
                <span style={{ color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ref.lineName || `Line ${ref.lineIndex + 1}`}
                </span>
                {selectedGroup.advancedDelay && (
                  <input
                    type="number"
                    step="0.25"
                    value={ref.delayOverride ?? ""}
                    placeholder={String(i * selectedGroup.delay)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setMemberDelayOverride(selectedGroup.id, "line", ref.lineIndex, undefined); return; }
                      const n = safeParseNumber(v);
                      if (n !== null) setMemberDelayOverride(selectedGroup.id, "line", ref.lineIndex, n);
                    }}
                    aria-label="Delay override (beats)"
                    style={{ ...NUM_INPUT_STYLE, width: 55, textAlign: "center", marginRight: "var(--space-4)" }}
                  />
                )}
                <IconButton
                  icon={X}
                  label="Remove from group"
                  size="sm"
                  danger
                  onClick={() => removeLineFromGroup(selectedGroup.id, ref.lineIndex)}
                />
              </div>
            ))}

            {/* Note members */}
            {selectedGroup.type === "note" && (selectedGroup as NoteGroup).notes.map((ref: GroupNoteRef, i: number) => {
              const line = chart.lines[ref.lineIndex];
              const note = line?.notes.find((n) => n.uid === ref.noteUid);
              const uidShort = ref.noteUid.slice(0, 6);
              const kindLabel = note?.kind ?? "?";
              const beatLabel = note ? beatToFloat(note.beat).toFixed(2) : "?";

              return (
                <div key={ref.noteUid} style={{ ...ROW_STYLE, borderBottom: i === (selectedGroup as NoteGroup).notes.length - 1 ? "none" : undefined }}>
                  <span style={{ color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                    {uidShort} · {kindLabel} @ {beatLabel}
                  </span>
                  {selectedGroup.advancedDelay && (
                    <input
                      type="number"
                      step="0.25"
                      value={ref.delayOverride ?? ""}
                      placeholder={String(i * selectedGroup.delay)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { setMemberDelayOverride(selectedGroup.id, "note", ref.noteUid, undefined); return; }
                        const n = safeParseNumber(v);
                        if (n !== null) setMemberDelayOverride(selectedGroup.id, "note", ref.noteUid, n);
                      }}
                      aria-label="Delay override (beats)"
                      style={{ ...NUM_INPUT_STYLE, width: 55, textAlign: "center", marginRight: "var(--space-4)" }}
                    />
                  )}
                  <IconButton
                    icon={X}
                    label="Remove from group"
                    size="sm"
                    danger
                    onClick={() => removeNoteFromGroup(selectedGroup.id, ref.noteUid)}
                  />
                </div>
              );
            })}
          </div>

          {/* Batch operations */}
          <div style={SECTION_STYLE}>Batch operations</div>

          {selectedGroup.type === "line" && (
            <LineBatchOps
              groupId={selectedGroup.id}
              group={selectedGroup as LineGroup}
              chart={chart}
              batchKind={batchKind}
              setBatchKind={setBatchKind}
              batchType={batchType}
              setBatchType={setBatchType}
              batchValue={batchValue}
              setBatchValue={setBatchValue}
              batchEndValue={batchEndValue}
              setBatchEndValue={setBatchEndValue}
              batchStartBeat={batchStartBeat}
              setBatchStartBeat={setBatchStartBeat}
              batchEndBeat={batchEndBeat}
              setBatchEndBeat={setBatchEndBeat}
              copySourceLine={copySourceLine}
              setCopySourceLine={setCopySourceLine}
              deleteKind={deleteKind}
              setDeleteKind={setDeleteKind}
              onAddEvent={handleBatchAddEvent}
              onCopyEvents={() => batchCopyEvents(selectedGroup.id, copySourceLine, batchKind)}
              onDeleteEvents={() => batchDeleteEvents(selectedGroup.id, deleteKind)}
            />
          )}

          {selectedGroup.type === "note" && (
            <NoteBatchOps
              groupId={selectedGroup.id}
              group={selectedGroup as NoteGroup}
              shiftDelta={shiftDelta}
              setShiftDelta={setShiftDelta}
              noteKind={noteKind}
              setNoteKind={setNoteKind}
              noteSpeed={noteSpeed}
              setNoteSpeed={setNoteSpeed}
              onShiftNotes={() => batchShiftNotes(selectedGroup.id, shiftDelta)}
              onChangeKind={() => batchChangeNoteKind(selectedGroup.id, noteKind)}
              onFlipNotes={() => batchFlipNotes(selectedGroup.id)}
              onChangeSpeed={() => batchChangeNoteSpeed(selectedGroup.id, noteSpeed)}
            />
          )}
        </div>
      )}
    </div>
  );
}
