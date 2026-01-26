import "./App.css";
import { validateSetup } from "./engine";
import type { TournamentSetup } from "./domain";

const setup: TournamentSetup = {
  teams: [{ id: "T1", name: "Team 1" }],
  tracks: ["table-1"],
  startMs: 0,
  slotDurationMs: 10 * 60 * 1000,
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
