import "./App.css";
import { useState } from "react";
import {
  capacityCheck,
  generateSchedule,
  validateSchedule,
  validateSetup,
} from "./engine";
import { presentationSlots } from "./engine/slots/presentationSlots";
import { robotSlots } from "./engine/slots/robotSlots";
import { AssignmentType, Track } from "./domain";
import type { Assignment, Slot, TournamentSetup } from "./domain";

const setup: TournamentSetup = {
  teams: [
    { id: 1, name: "Team 1" },
    { id: 2, name: "Team 2" },
  ],
  robotTablesCount: 4,
  robotStartMs: new Date(2026, 0, 15, 9, 0, 0, 0).getTime(),
  robotEndMs: new Date(2026, 0, 15, 12, 0, 0, 0).getTime(),
  robotBreaks: [],
  presentationRoomsCount: 2,
  presentationStartMs: new Date(2026, 0, 15, 9, 30, 0, 0).getTime(),
  presentationEndMs: new Date(2026, 0, 15, 12, 30, 0, 0).getTime(),
  presentationBreaks: [],
  minGapMinutes: 15,
  suggestBreaks: false,
  suggestResources: false,
};

const conflictSlots: Slot[] = [
  {
    id: "robot-930",
    track: Track.ROBOT,
    startMs: new Date(2026, 0, 15, 9, 30, 0, 0).getTime(),
    endMs: new Date(2026, 0, 15, 9, 35, 0, 0).getTime(),
    resources: { tableIds: [1] },
  },
  {
    id: "presentation-930",
    track: Track.PRESENTATION,
    startMs: new Date(2026, 0, 15, 9, 30, 0, 0).getTime(),
    endMs: new Date(2026, 0, 15, 10, 0, 0, 0).getTime(),
    resources: { roomIds: [1] },
  },
];

const conflictAssignments: Assignment[] = [
  {
    id: "conflict-robot",
    teamId: 1,
    type: AssignmentType.ROBOT_MATCH,
    slotId: "robot-930",
    resourceId: "1",
    sequence: 1,
  },
  {
    id: "conflict-presentation",
    teamId: 1,
    type: AssignmentType.PRESENTATION,
    slotId: "presentation-930",
    resourceId: "1",
    sequence: null,
  },
];

type DraftCounts = {
  presentations: number;
  robots: number;
  total: number;
};

function App() {
  const [draftCounts, setDraftCounts] = useState<DraftCounts | null>(null);
  const validationResult = validateSetup(setup);
  const engineStatus = validationResult.ok
    ? "Setup OK"
    : validationResult.errors[0]?.code ?? "UNKNOWN_ERROR";
  const presentationSlotsCount = presentationSlots({
    presentationStartMs: setup.presentationStartMs,
    presentationEndMs: setup.presentationEndMs,
    presentationRoomsCount: setup.presentationRoomsCount,
    presentationBreaks: setup.presentationBreaks,
  }).length;
  const robotSlotsList = robotSlots({
    robotStartMs: setup.robotStartMs,
    robotEndMs: setup.robotEndMs,
    robotTablesCount: setup.robotTablesCount,
    robotBreaks: setup.robotBreaks,
  });
  const robotCapacity = robotSlotsList.reduce(
    (sum, slot) => sum + (slot.resources.tableIds?.length ?? 0),
    0,
  );
  const capacityResult = capacityCheck(setup);
  const conflicts = validateSchedule(
    setup,
    conflictSlots,
    conflictAssignments,
  );

  const handleGenerateDraft = () => {
    const result = generateSchedule(setup);
    if (!result.ok) {
      setDraftCounts(null);
      return;
    }

    const presentationCount = result.schedule.assignments.filter(
      (assignment) => assignment.type === AssignmentType.PRESENTATION,
    ).length;
    const robotCount = result.schedule.assignments.filter(
      (assignment) => assignment.type === AssignmentType.ROBOT_MATCH,
    ).length;

    setDraftCounts({
      presentations: presentationCount,
      robots: robotCount,
      total: presentationCount + robotCount,
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>FLL Tournament Planner</h1>
      </header>
      <section className="engine-status" aria-label="Engine status">
        <h2>Engine status</h2>
        <p>{engineStatus}</p>
        <p>Capacity status:</p>
        {capacityResult.ok ? (
          <p>Capacity OK</p>
        ) : (
          <ul>
            {capacityResult.errors.map((error) => (
              <li key={error.code}>{error.code}</li>
            ))}
          </ul>
        )}
        <p>Presentation slots: {presentationSlotsCount}</p>
        <p>Robot slots: {robotSlotsList.length}</p>
        <p>Robot capacity: {robotCapacity} (sum of active tables)</p>
        <p>Conflicts: {conflicts.length}</p>
        <button type="button" onClick={handleGenerateDraft}>
          Generate Draft
        </button>
        <p>
          Presentations:{" "}
          {draftCounts === null ? "Not generated" : draftCounts.presentations}
        </p>
        <p>
          Robot matches:{" "}
          {draftCounts === null ? "Not generated" : draftCounts.robots}
        </p>
        <p>
          Total assignments:{" "}
          {draftCounts === null ? "Not generated" : draftCounts.total}
        </p>
      </section>
    </div>
  );
}

export default App;
