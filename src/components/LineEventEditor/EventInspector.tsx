// ============================================================
// Event Inspector — Sidebar for the Line Event Editor
//
// Shows numeric values for all event properties at the current
// beat. Allows editing event values, adding new events, and
// adjusting opacity/speed numerically.
// ============================================================

import { useChartStore } from "../../stores/chartStore";
import { useEditorStore } from "../../stores/editorStore";
import { evaluateLineEventsWithLayers } from "../../canvas/events";
import { resolveActiveKindEvents } from "../../utils/eventRouting";
import { Field, SelectField, BeatField, EASING_OPTIONS } from "../common/FormFields";
import { beatToFloat, floatToBeat } from "../../types/chart";
import type { LineEvent, LineEventKind, EasingType } from "../../types/chart";
import { EVENT_COLORS } from "../../constants/eventColors";
import { defaultEventValue, defaultEventTransition } from "../../constants/eventConfig";
import { Plus } from "lucide-react";
import { Button } from "../common/Button";
import { LANE_LABEL } from "../KeyframeBar/curveEditorUtils";

const KIND_LABELS: Record<LineEventKind, string> = {
  x: "X position",
  y: "Y position",
  rotation: "Rotation",
  opacity: "Opacity",
  speed: "Speed",
  scale_x: "Scale X",
  scale_y: "Scale Y",
  color: "Colour",
  text: "Text",
  incline: "Incline",
  gif: "GIF progress",
};

interface EventInspectorProps {
  lineIndex: number;
}

/**
 * Find the active event at the given beat within an already kind-filtered array
 * (the caller passes resolveActiveKindEvents, so flat-vs-layer is handled —
 * finding L3). Returns the event itself; edits go through editEventById, so no
 * array index is needed.
 */
function findActiveEvent(events: LineEvent[], beat: number): LineEvent | null {
  for (const e of events) {
    const start = beatToFloat(e.start_beat);
    const end = beatToFloat(e.end_beat);
    if (beat >= start && beat <= end) return e;
  }
  return null;
}

export function EventInspector({ lineIndex }: EventInspectorProps) {
  const chart = useChartStore((s) => s.chart);
  const addEventRouted = useChartStore((s) => s.addEventRouted);
  const currentBeat = useEditorStore((s) => s.eventEditorCurrentBeat);
  const activeProperty = useEditorStore((s) => s.eventEditorActiveProperty);
  const activeLayer = useEditorStore((s) => s.eventEditorActiveLayer);

  const line = chart.lines[lineIndex];
  if (!line) {
    return (
      <div className="p-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        Line not found
      </div>
    );
  }

  // Evaluate all properties at current beat
  const state = evaluateLineEventsWithLayers(line.events, line.event_layers, currentBeat);

  // Find the active event for the selected property — in the array the evaluator
  // reads (active layer on a layered chart, else flat). finding L3.
  const activeEvent = findActiveEvent(
    resolveActiveKindEvents(line, activeProperty, activeLayer),
    currentBeat,
  );

  const rotDeg = (state.rotation * 180) / Math.PI;
  const opacityVal = Math.round(state.opacity * 255);

  return (
    <div className="flex flex-col h-full overflow-y-auto text-xs">
      {/* Current Beat */}
      <div className="p-2 border-b" style={{ borderColor: "var(--separator)" }}>
        <div className="font-medium mb-1" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          Beat {currentBeat.toFixed(2)}
        </div>
      </div>

      {/* Evaluated Values */}
      <div className="p-2 border-b" style={{ borderColor: "var(--separator)" }}>
        <div
          className="mb-1.5"
          style={{ fontSize: "var(--fs-control)", fontWeight: 600, color: "var(--text-secondary)" }}
        >
          Current values
        </div>
        {([
          { kind: "x" as const, value: state.x.toFixed(1) },
          { kind: "y" as const, value: state.y.toFixed(1) },
          { kind: "rotation" as const, value: `${rotDeg.toFixed(1)}°` },
          { kind: "opacity" as const, value: String(opacityVal) },
          { kind: "speed" as const, value: state.speed.toFixed(2) },
        ]).map(({ kind, value }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={activeProperty === kind}
            title={KIND_LABELS[kind]}
            className="ui-hover flex items-center gap-2 py-0.5 px-1 w-full text-left"
            style={{
              border: "none",
              borderRadius: "var(--radius-sm)",
              font: "inherit",
              cursor: "pointer",
              background: activeProperty === kind ? "var(--accent-selected)" : undefined,
            }}
            onClick={() => useEditorStore.getState().setEventEditorActiveProperty(kind)}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: EVENT_COLORS[kind] }}
            />
            <span className="w-10" style={{ color: "var(--text-secondary)" }}>{LANE_LABEL[kind]}</span>
            <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{value}</span>
          </button>
        ))}
      </div>

      {/* Active Event Details */}
      <div className="p-2 border-b" style={{ borderColor: "var(--separator)" }}>
        <div className="font-medium mb-1.5" style={{ color: EVENT_COLORS[activeProperty] }}>
          {KIND_LABELS[activeProperty]}
        </div>

        {activeEvent && activeEvent.id ? (
          <ActiveEventEditor
            event={activeEvent}
            eventId={activeEvent.id}
            lineIndex={lineIndex}
          />
        ) : (
          <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            No event at this beat
          </div>
        )}
      </div>

      {/* Add Event Buttons */}
      <div className="p-2 flex flex-col gap-1">
        <Button
          icon={Plus}
          block
          onClick={() => {
            const snappedBeat = floatToBeat(currentBeat);
            // Short span, not [1000]: a constant holds via inheritance, so the far-end
            // baseline is unnecessary and would shadow later events under the value-
            // tiebreak (finding L4). M6: defaultEventValue produces a valid shape for
            // color/text too, not a bare { constant: 0 }.
            addEventRouted(lineIndex, {
              kind: activeProperty,
              start_beat: snappedBeat,
              end_beat: floatToBeat(currentBeat + 1),
              value: defaultEventValue(activeProperty),
            }, activeLayer);
          }}
        >
          Add constant
        </Button>
        <Button
          icon={Plus}
          block
          onClick={() => {
            const startBeat = floatToBeat(currentBeat);
            const endBeat = floatToBeat(currentBeat + 4); // 4 beats long
            // M6: defaultEventTransition gives a valid color_transition/text_transition
            // shape for those kinds, not a numeric { transition } with a 0 value.
            addEventRouted(lineIndex, {
              kind: activeProperty,
              start_beat: startBeat,
              end_beat: endBeat,
              value: defaultEventTransition(activeProperty),
            }, activeLayer);
          }}
        >
          Add transition
        </Button>
      </div>
    </div>
  );
}

/** Editor for the currently active event */
function ActiveEventEditor({
  event,
  eventId,
  lineIndex,
}: {
  event: LineEvent;
  eventId: string;
  lineIndex: number;
}) {
  // Edit by stable id (finding L3) so the inspector works whether the active
  // event lives in flat line.events or an event layer's kind-array.
  const editEventById = useChartStore((s) => s.editEventById);
  const isTransition = "transition" in event.value;
  const tv = isTransition ? (event.value as { transition: { start: number; end: number; easing: EasingType } }).transition : null;
  const cv = !isTransition ? (event.value as { constant: number }).constant : null;
  const startVal = tv ? tv.start : cv!;
  const endVal = tv ? tv.end : cv!;

  return (
    <div className="flex flex-col gap-1.5">
      <BeatField
        label="Start"
        beat={event.start_beat}
        onChange={(b) => editEventById(lineIndex, eventId, { start_beat: b })}
      />
      <BeatField
        label="End"
        beat={event.end_beat}
        onChange={(b) => editEventById(lineIndex, eventId, { end_beat: b })}
      />
      <SelectField
        label="Type"
        value={isTransition ? "transition" : "constant"}
        options={[
          { value: "transition", label: "Transition" },
          { value: "constant", label: "Constant" },
        ]}
        onChange={(v) => {
          if (v === "constant") {
            editEventById(lineIndex, eventId, { value: { constant: startVal } });
          } else {
            editEventById(lineIndex, eventId, {
              value: { transition: { start: startVal, end: endVal, easing: "linear" } },
            });
          }
        }}
      />
      {isTransition && tv ? (
        <>
          <Field
            label="Start val"
            value={startVal}
            onChange={(v) =>
              editEventById(lineIndex, eventId, {
                value: {
                  transition: {
                    start: parseFloat(v),
                    end: tv.end,
                    easing: tv.easing,
                  },
                },
              })
            }
            step="0.1"
          />
          <Field
            label="End val"
            value={endVal}
            onChange={(v) =>
              editEventById(lineIndex, eventId, {
                value: {
                  transition: {
                    start: tv.start,
                    end: parseFloat(v),
                    easing: tv.easing,
                  },
                },
              })
            }
            step="0.1"
          />
          <SelectField
            label="Easing"
            value={typeof tv.easing === "string" ? tv.easing : "linear"}
            options={EASING_OPTIONS}
            onChange={(v) =>
              editEventById(lineIndex, eventId, {
                value: {
                  transition: {
                    start: tv.start,
                    end: tv.end,
                    easing: v as EasingType,
                  },
                },
              })
            }
          />
        </>
      ) : (
        <Field
          label="Value"
          value={startVal}
          onChange={(v) =>
            editEventById(lineIndex, eventId, { value: { constant: parseFloat(v) } })
          }
          step="0.1"
        />
      )}
    </div>
  );
}
