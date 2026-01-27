import "./App.css";
import { validateSetup } from "./engine";
import type { TournamentSetup } from "./domain";

const setup: TournamentSetup = {
  teams: [{ id: 1, name: "Team 1" }],
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
  const engineStatus = validateSetup(setup).ok ? "Engine OK" : "Engine Error";

  return (
    <div className="app">
      <header className="app-header">
        <h1>FLL Tournament Planner</h1>
      </header>
      <section className="engine-status" aria-label="Engine status">
        <h2>Engine status</h2>
        <p>{engineStatus}</p>
      </section>
    </div>
  );
}

export default App;
