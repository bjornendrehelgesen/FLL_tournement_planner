import "./App.css";
import { validateSetup } from "./engine";
import { presentationSlots } from "./engine/slots/presentationSlots";
import { robotSlots } from "./engine/slots/robotSlots";
import type { TournamentSetup } from "./domain";

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

function App() {
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

  return (
    <div className="app">
      <header className="app-header">
        <h1>FLL Tournament Planner</h1>
      </header>
      <section className="engine-status" aria-label="Engine status">
        <h2>Engine status</h2>
        <p>{engineStatus}</p>
        <p>Presentation slots: {presentationSlotsCount}</p>
        <p>Robot slots: {robotSlotsList.length}</p>
        <p>Robot capacity: {robotCapacity} (sum of active tables)</p>
      </section>
    </div>
  );
}

export default App;
