import "./App.css";
import { useMemo, useState } from "react";
import { generateSchedule, validateSetup } from "./engine";
import { formatLocalDateTime, parseLocalDateTime } from "./domain/time";
import type {
  Assignment,
  GenerateScheduleResult,
  SuggestionAction,
  Team,
  TournamentSetup,
} from "./domain";
import { AssignmentType, Track } from "./domain";

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
const ROBOT_MATCHES_PER_TEAM = 3;

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

function formatShortTime(valueMs: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(valueMs));
}

function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatShortTime(startMs)} - ${formatShortTime(endMs)}`;
}

function formatAssignmentCell(
  assignment: Assignment | null,
  slotById: Map<string, { startMs: number; endMs: number }>,
  resourceLabel: string
): string {
  if (!assignment) return "TBD";
  const slot = slotById.get(assignment.slotId);
  const timeLabel = slot
    ? formatTimeRange(slot.startMs, slot.endMs)
    : "Time TBD";
  const resourceText = assignment.resourceId
    ? `${resourceLabel} ${assignment.resourceId}`
    : resourceLabel;
  return `${timeLabel} | ${resourceText}`;
}

function formatSuggestion(suggestion: SuggestionAction): string {
  switch (suggestion.action) {
    case "INCREASE_ROBOT_TABLES":
      return suggestion.by
        ? `Increase robot tables by ${suggestion.by}.`
        : "Increase robot tables.";
    case "INCREASE_PRESENTATION_ROOMS":
      return suggestion.by
        ? `Increase presentation rooms by ${suggestion.by}.`
        : "Increase presentation rooms.";
    case "EXTEND_ROBOT_END_TIME":
      return suggestion.minutes
        ? `Extend robot end time by ${suggestion.minutes} minutes.`
        : "Extend robot end time.";
    case "EXTEND_PRESENTATION_END_TIME":
      return suggestion.minutes
        ? `Extend presentation end time by ${suggestion.minutes} minutes.`
        : "Extend presentation end time.";
    case "REDUCE_MIN_GAP":
      return suggestion.minutes
        ? `Reduce minimum gap by ${suggestion.minutes} minutes.`
        : "Reduce minimum gap requirement.";
    case "ADD_BREAK": {
      const trackLabel =
        suggestion.track === Track.ROBOT ? "robot" : "presentation";
      const windowLabel = `${formatLocalDateTime(
        suggestion.window.startMs
      )} to ${formatLocalDateTime(suggestion.window.endMs)}`;
      return `Add a ${trackLabel} break from ${windowLabel}.`;
    }
    case "ADJUST_BREAKS": {
      const trackLabel =
        suggestion.track === Track.ROBOT ? "robot" : "presentation";
      return `Adjust ${trackLabel} break timing.`;
    }
    default: {
      const exhaustiveCheck: never = suggestion;
      return `${exhaustiveCheck}`;
    }
  }
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
          warnings: scheduleResult.schedule.warnings,
        }
      : null;

  const scheduleTableRows = useMemo(() => {
    if (!scheduleResult || !scheduleResult.ok) return [];
    const { assignments, slots } = scheduleResult.schedule;
    const slotById = new Map(
      slots.map((slot) => [slot.id, { startMs: slot.startMs, endMs: slot.endMs }])
    );
    const teamsById = new Map(setup.teams.map((team) => [team.id, team]));
    const teamIds = Array.from(new Set(assignments.map((assignment) => assignment.teamId)))
      .sort((a, b) => a - b);

    return teamIds.map((teamId) => {
      const robotMatches = Array.from(
        { length: ROBOT_MATCHES_PER_TEAM },
        () => null as Assignment | null
      );
      let presentation: Assignment | null = null;

      for (const assignment of assignments) {
        if (assignment.teamId !== teamId) continue;
        if (assignment.type === AssignmentType.PRESENTATION) {
          presentation = assignment;
          continue;
        }
        if (
          assignment.type === AssignmentType.ROBOT_MATCH &&
          assignment.sequence &&
          assignment.sequence >= 1 &&
          assignment.sequence <= ROBOT_MATCHES_PER_TEAM
        ) {
          robotMatches[assignment.sequence - 1] = assignment;
        }
      }

      const teamLabel = teamsById.get(teamId)?.name ?? `Team ${teamId}`;
      return {
        teamId,
        teamLabel,
        presentation,
        robotMatches,
        slotById,
      };
    });
  }, [scheduleResult, setup.teams]);

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
            <div className="result success">
              <div className="result-header">
                <h3>Valid schedule generated</h3>
                <p>Counts and warnings are ready to review.</p>
              </div>
              <div className="result-metrics">
                <div>
                  <span className="metric-label">Presentation slots</span>
                  <span className="metric-value">
                    {scheduleSummary.presentations}
                  </span>
                </div>
                <div>
                  <span className="metric-label">Robot matches</span>
                  <span className="metric-value">{scheduleSummary.robots}</span>
                </div>
                <div>
                  <span className="metric-label">Total assignments</span>
                  <span className="metric-value">
                    {scheduleSummary.presentations + scheduleSummary.robots}
                  </span>
                </div>
              </div>
              <div className="panel warnings">
                <div className="panel-title">Warnings</div>
                {scheduleSummary.warnings.length === 0 ? (
                  <p className="hint">No warnings detected.</p>
                ) : (
                  <ul>
                    {scheduleSummary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="panel schedule-table">
                <div className="panel-title">Team schedule</div>
                {scheduleTableRows.length === 0 ? (
                  <p className="hint">No assignments to show yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Team</th>
                          <th scope="col">Presentation (time + room)</th>
                          <th scope="col">Robot match 1 (time + table)</th>
                          <th scope="col">Robot match 2 (time + table)</th>
                          <th scope="col">Robot match 3 (time + table)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleTableRows.map((row) => (
                          <tr key={row.teamId}>
                            <th scope="row">{row.teamLabel}</th>
                            <td>
                              {formatAssignmentCell(
                                row.presentation,
                                row.slotById,
                                "Room"
                              )}
                            </td>
                            {row.robotMatches.map((match, index) => (
                              <td key={`${row.teamId}-match-${index + 1}`}>
                                {formatAssignmentCell(
                                  match,
                                  row.slotById,
                                  "Table"
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {scheduleResult && !scheduleResult.ok && (
            <div className="result error">
              <div className="result-header">
                <h3>Unable to generate schedule</h3>
                <p>Review errors and suggestions to adjust the setup.</p>
              </div>
              <div className="panel errors">
                <div className="panel-title">Errors</div>
                <ul>
                  {scheduleResult.errors.map((error) => (
                    <li key={`${error.code}-${error.message}`}>
                      <span className="pill">{error.code}</span>
                      <span>{error.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel suggestions">
                <div className="panel-title">Suggestions</div>
                {scheduleResult.suggestions.length === 0 ? (
                  <p className="hint">No suggestions available yet.</p>
                ) : (
                  <ul>
                    {scheduleResult.suggestions.map((suggestion, index) => (
                      <li key={`${suggestion.action}-${index}`}>
                        <span>{formatSuggestion(suggestion)}</span>
                        <button
                          type="button"
                          className="ghost apply-button"
                          disabled
                        >
                          Apply
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
