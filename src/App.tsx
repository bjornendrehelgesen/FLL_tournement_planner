import "./App.css";
import { useMemo, useState } from "react";
import { generateSchedule, validateSetup } from "./engine";
import { formatLocalDateTime, parseLocalDateTime } from "./domain/time";
import type {
  GenerateScheduleResult,
  Team,
  TournamentSetup,
} from "./domain";
import { AssignmentType } from "./domain";

const DEFAULT_DATE = new Date(2026, 0, 15, 9, 0, 0, 0);
const DEFAULT_SETUP: TournamentSetup = {
  teams: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
  })),
  robotTablesCount: 4,
  robotStartMs: DEFAULT_DATE.getTime(),
  robotEndMs: new Date(2026, 0, 15, 12, 0, 0, 0).getTime(),
  robotBreaks: [],
  presentationRoomsCount: 3,
  presentationStartMs: new Date(2026, 0, 15, 9, 30, 0, 0).getTime(),
  presentationEndMs: new Date(2026, 0, 15, 12, 30, 0, 0).getTime(),
  presentationBreaks: [],
  minGapMinutes: 15,
  suggestBreaks: false,
  suggestResources: false,
};

const DEFAULT_BREAK_MINUTES = 15;

function buildTeams(count: number): Team[] {
  if (!Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
  }));
}

function FieldErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="field-errors" role="alert">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

function App() {
  const [setup, setSetup] = useState<TournamentSetup>(DEFAULT_SETUP);
  const [scheduleResult, setScheduleResult] =
    useState<GenerateScheduleResult | null>(null);

  const validation = useMemo(() => validateSetup(setup), [setup]);
  const errorMap = useMemo(() => {
    if (validation.ok) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    validation.errors.forEach((error) => {
      const key = error.path ?? "root";
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, error.message]);
    });
    return map;
  }, [validation]);

  const getErrors = (path: string) => errorMap.get(path) ?? [];

  const handleAddBreak = (track: "robot" | "presentation") => {
    setSetup((prev) => {
      const key = track === "robot" ? "robotBreaks" : "presentationBreaks";
      const windowStart =
        track === "robot" ? prev.robotStartMs : prev.presentationStartMs;
      const windowEnd =
        track === "robot" ? prev.robotEndMs : prev.presentationEndMs;
      const startMs = windowStart;
      const endMs = Math.min(
        windowStart + DEFAULT_BREAK_MINUTES * 60_000,
        windowEnd
      );
      const nextBreaks = [...prev[key], { startMs, endMs }];
      return { ...prev, [key]: nextBreaks };
    });
  };

  const handleBreakChange = (
    track: "robot" | "presentation",
    index: number,
    field: "startMs" | "endMs",
    value: string
  ) => {
    const parsed = parseLocalDateTime(value);
    if (parsed === null) return;
    setSetup((prev) => {
      const key = track === "robot" ? "robotBreaks" : "presentationBreaks";
      const nextBreaks = prev[key].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: parsed } : entry
      );
      return { ...prev, [key]: nextBreaks };
    });
  };

  const handleBreakRemove = (
    track: "robot" | "presentation",
    index: number
  ) => {
    setSetup((prev) => {
      const key = track === "robot" ? "robotBreaks" : "presentationBreaks";
      const nextBreaks = prev[key].filter((_, entryIndex) => entryIndex !== index);
      return { ...prev, [key]: nextBreaks };
    });
  };

  const handleWindowChange = (
    field: "robotStartMs" | "robotEndMs" | "presentationStartMs" | "presentationEndMs",
    value: string
  ) => {
    const parsed = parseLocalDateTime(value);
    if (parsed === null) return;
    setSetup((prev) => ({ ...prev, [field]: parsed }));
  };

  const handleGenerate = () => {
    const result = generateSchedule(setup);
    setScheduleResult(result);
  };

  const scheduleSummary =
    scheduleResult && scheduleResult.ok
      ? {
          presentations: scheduleResult.schedule.assignments.filter(
            (assignment) => assignment.type === AssignmentType.PRESENTATION
          ).length,
          robots: scheduleResult.schedule.assignments.filter(
            (assignment) => assignment.type === AssignmentType.ROBOT_MATCH
          ).length,
        }
      : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>FLL Tournament Planner</h1>
        <p>Configure your tournament setup to generate a draft schedule.</p>
      </header>

      <main className="setup">
        <section className="card">
          <h2>Quick start</h2>
          <div className="field">
            <label htmlFor="teams-count">Number of teams</label>
            <input
              id="teams-count"
              type="number"
              min={2}
              required
              value={setup.teams.length}
              onChange={(event) => {
                const count = Number(event.target.value);
                setSetup((prev) => ({ ...prev, teams: buildTeams(count) }));
              }}
            />
            <FieldErrors errors={getErrors("teams")} />
          </div>
        </section>

        <section className="card">
          <h2>Robot rounds</h2>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="robot-tables">Robot tables</label>
              <input
                id="robot-tables"
                type="number"
                min={1}
                value={setup.robotTablesCount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSetup((prev) => ({ ...prev, robotTablesCount: value }));
                }}
              />
              <FieldErrors errors={getErrors("robotTablesCount")} />
            </div>
            <div className="field">
              <label htmlFor="robot-start">Start</label>
              <input
                id="robot-start"
                type="datetime-local"
                value={formatLocalDateTime(setup.robotStartMs)}
                onChange={(event) =>
                  handleWindowChange("robotStartMs", event.target.value)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="robot-end">End</label>
              <input
                id="robot-end"
                type="datetime-local"
                value={formatLocalDateTime(setup.robotEndMs)}
                onChange={(event) =>
                  handleWindowChange("robotEndMs", event.target.value)
                }
              />
              <FieldErrors errors={getErrors("robotWindow")} />
            </div>
          </div>

          <div className="breaks">
            <div className="breaks-header">
              <h3>Robot breaks</h3>
              <button type="button" onClick={() => handleAddBreak("robot")}>Add break</button>
            </div>
            {setup.robotBreaks.length === 0 ? (
              <p className="hint">No robot breaks yet.</p>
            ) : (
              setup.robotBreaks.map((breakWindow, index) => (
                <div className="break-row" key={`robot-break-${index}`}>
                  <div className="field">
                    <label htmlFor={`robot-break-start-${index}`}>Start</label>
                    <input
                      id={`robot-break-start-${index}`}
                      type="datetime-local"
                      value={formatLocalDateTime(breakWindow.startMs)}
                      onChange={(event) =>
                        handleBreakChange(
                          "robot",
                          index,
                          "startMs",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`robot-break-end-${index}`}>End</label>
                    <input
                      id={`robot-break-end-${index}`}
                      type="datetime-local"
                      value={formatLocalDateTime(breakWindow.endMs)}
                      onChange={(event) =>
                        handleBreakChange(
                          "robot",
                          index,
                          "endMs",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => handleBreakRemove("robot", index)}
                  >
                    Remove
                  </button>
                  <FieldErrors errors={getErrors(`robotBreaks[${index}]`)} />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Presentation sessions</h2>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="presentation-rooms">Presentation rooms</label>
              <input
                id="presentation-rooms"
                type="number"
                min={1}
                value={setup.presentationRoomsCount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSetup((prev) => ({ ...prev, presentationRoomsCount: value }));
                }}
              />
              <FieldErrors errors={getErrors("presentationRoomsCount")} />
            </div>
            <div className="field">
              <label htmlFor="presentation-start">Start</label>
              <input
                id="presentation-start"
                type="datetime-local"
                value={formatLocalDateTime(setup.presentationStartMs)}
                onChange={(event) =>
                  handleWindowChange("presentationStartMs", event.target.value)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="presentation-end">End</label>
              <input
                id="presentation-end"
                type="datetime-local"
                value={formatLocalDateTime(setup.presentationEndMs)}
                onChange={(event) =>
                  handleWindowChange("presentationEndMs", event.target.value)
                }
              />
              <FieldErrors errors={getErrors("presentationWindow")} />
            </div>
          </div>

          <div className="breaks">
            <div className="breaks-header">
              <h3>Presentation breaks</h3>
              <button
                type="button"
                onClick={() => handleAddBreak("presentation")}
              >
                Add break
              </button>
            </div>
            {setup.presentationBreaks.length === 0 ? (
              <p className="hint">No presentation breaks yet.</p>
            ) : (
              setup.presentationBreaks.map((breakWindow, index) => (
                <div className="break-row" key={`presentation-break-${index}`}>
                  <div className="field">
                    <label htmlFor={`presentation-break-start-${index}`}>Start</label>
                    <input
                      id={`presentation-break-start-${index}`}
                      type="datetime-local"
                      value={formatLocalDateTime(breakWindow.startMs)}
                      onChange={(event) =>
                        handleBreakChange(
                          "presentation",
                          index,
                          "startMs",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`presentation-break-end-${index}`}>End</label>
                    <input
                      id={`presentation-break-end-${index}`}
                      type="datetime-local"
                      value={formatLocalDateTime(breakWindow.endMs)}
                      onChange={(event) =>
                        handleBreakChange(
                          "presentation",
                          index,
                          "endMs",
                          event.target.value
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => handleBreakRemove("presentation", index)}
                  >
                    Remove
                  </button>
                  <FieldErrors
                    errors={getErrors(`presentationBreaks[${index}]`)}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h2>Constraints</h2>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="min-gap">Minimum gap (minutes)</label>
              <input
                id="min-gap"
                type="number"
                min={15}
                value={setup.minGapMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSetup((prev) => ({ ...prev, minGapMinutes: value }));
                }}
              />
              <FieldErrors errors={getErrors("minGapMinutes")} />
            </div>
            <div className="field checkbox">
              <label htmlFor="suggest-breaks">
                <input
                  id="suggest-breaks"
                  type="checkbox"
                  checked={setup.suggestBreaks}
                  onChange={(event) =>
                    setSetup((prev) => ({
                      ...prev,
                      suggestBreaks: event.target.checked,
                    }))
                  }
                />
                Suggest breaks
              </label>
            </div>
            <div className="field checkbox">
              <label htmlFor="suggest-resources">
                <input
                  id="suggest-resources"
                  type="checkbox"
                  checked={setup.suggestResources}
                  onChange={(event) =>
                    setSetup((prev) => ({
                      ...prev,
                      suggestResources: event.target.checked,
                    }))
                  }
                />
                Suggest resource increases
              </label>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Generate schedule</h2>
          <p className="hint">
            {validation.ok
              ? "Setup looks good. You can generate a draft schedule."
              : "Fix the highlighted fields before generating."}
          </p>
          <button
            type="button"
            className="primary"
            disabled={!validation.ok}
            onClick={handleGenerate}
          >
            Generate schedule
          </button>

          {scheduleResult && scheduleResult.ok && scheduleSummary && (
            <div className="summary">
              <p>Draft schedule ready.</p>
              <p>Presentation slots: {scheduleSummary.presentations}</p>
              <p>Robot matches: {scheduleSummary.robots}</p>
              <p>
                Total assignments: {scheduleSummary.presentations + scheduleSummary.robots}
              </p>
            </div>
          )}

          {scheduleResult && !scheduleResult.ok && (
            <div className="summary error">
              <p>Unable to generate schedule:</p>
              <ul>
                {scheduleResult.errors.map((error) => (
                  <li key={error.code}>{error.message}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
