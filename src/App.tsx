import "./App.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  pointerWithin,
} from "@dnd-kit/core";
import {
  autoReshuffle,
  generateSchedule,
  validateSchedule,
  validateSetup,
  type AutoReshuffleFailureReason,
  type PresentationMove,
} from "./engine";
import {
  applyPresentationMove,
  type PresentationDragData,
  type PresentationDropData,
} from "./presentationDnd";
import {
  applyRobotMove,
  type RobotDragData,
  type RobotDropData,
} from "./robotDnd";
import { formatLocalDateTime, parseLocalDateTime } from "./domain/time";
import type {
  Assignment,
  GenerateScheduleResult,
  ScheduleConflict,
  SuggestionAction,
  Slot,
  Team,
  TournamentSetup,
} from "./domain";
import { AssignmentType, Track } from "./domain";
import {
  createLocalStorageSetupRepository,
  type SetupSummary,
} from "./storage/setupRepository";

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
const EMPTY_CELL_LABEL = "Empty";

type ScheduleTab = "teams" | "robots" | "presentations";
type EditMode = "manual" | "auto";
type GridCell = { resourceId: number; teamId: number | null };
type GridRow = { slotId: string; timeLabel: string; cells: GridCell[] };

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

function normalizeResourceId(resourceId: number | string): string {
  return String(resourceId).trim();
}

function buildGridRows(
  slots: Slot[],
  assignments: Assignment[],
  track: Track,
  resourceKey: "tableIds" | "roomIds"
): GridRow[] {
  const assignmentByCell = new Map<string, Assignment>();

  for (const assignment of assignments) {
    assignmentByCell.set(`${assignment.slotId}::${assignment.resourceId}`, assignment);
  }

  return [...slots]
    .filter((slot) => slot.track === track)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id))
    .map((slot) => {
      const resourceIds = [...(slot.resources[resourceKey] ?? [])].sort(
        (a, b) => a - b
      );
      const cells = resourceIds.map((resourceId) => {
        const assignment = assignmentByCell.get(
          `${slot.id}::${resourceId}`
        );
        return {
          resourceId,
          teamId: assignment ? assignment.teamId : null,
        };
      });

      return {
        slotId: slot.id,
        timeLabel: formatTimeRange(slot.startMs, slot.endMs),
        cells,
      };
    });
}

function shouldShowSuggestion(
  suggestion: SuggestionAction,
  setup: TournamentSetup,
): boolean {
  switch (suggestion.action) {
    case "ADD_BREAK":
    case "ADJUST_BREAKS":
      return setup.suggestBreaks;
    default:
      return setup.suggestResources;
  }
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
      return `Add a ${trackLabel} break from ${windowLabel} (creates separation between tracks).`;
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

function PresentationGridCell({
  slotId,
  resourceId,
  teamId,
  isConflictCell,
  isEnabled,
}: {
  slotId: string;
  resourceId: number;
  teamId: number | null;
  isConflictCell: boolean;
  isEnabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: `presentation-drag-${slotId}-${resourceId}`,
    data:
      teamId === null
        ? undefined
        : ({
            type: "presentation",
            slotId,
            resourceId,
            teamId,
          } satisfies PresentationDragData),
    disabled: !isEnabled || teamId === null,
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `presentation-drop-${slotId}-${resourceId}`,
    data: {
      type: "presentation",
      slotId,
      resourceId,
    } satisfies PresentationDropData,
    disabled: !isEnabled,
  });

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    },
    [setDraggableRef, setDroppableRef]
  );

  return (
    <div
      ref={setNodeRef}
      data-testid={`presentation-cell-${slotId}-${resourceId}`}
      className={`grid-cell ${teamId === null ? "empty" : "filled"} ${
        isConflictCell ? "conflict" : ""
      } ${isEnabled && teamId !== null ? "draggable" : ""} ${
        isDragging ? "dragging" : ""
      } ${isOver && isEnabled ? "droppable-over" : ""}`}
      {...(isEnabled && teamId !== null ? attributes : {})}
      {...(isEnabled && teamId !== null ? listeners : {})}
    >
      {teamId === null ? EMPTY_CELL_LABEL : String(teamId)}
    </div>
  );
}

function RobotGridCell({
  slotId,
  resourceId,
  teamId,
  isConflictCell,
  isEnabled,
}: {
  slotId: string;
  resourceId: number;
  teamId: number | null;
  isConflictCell: boolean;
  isEnabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: `robot-drag-${slotId}-${resourceId}`,
    data:
      teamId === null
        ? undefined
        : ({
            type: "robot",
            slotId,
            tableId: resourceId,
            teamId,
          } satisfies RobotDragData),
    disabled: !isEnabled || teamId === null,
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `robot-drop-${slotId}-${resourceId}`,
    data: {
      type: "robot",
      slotId,
      tableId: resourceId,
    } satisfies RobotDropData,
    disabled: !isEnabled,
  });

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableRef(node);
      setDroppableRef(node);
    },
    [setDraggableRef, setDroppableRef]
  );

  return (
    <div
      ref={setNodeRef}
      data-testid={`robot-cell-${slotId}-${resourceId}`}
      className={`grid-cell ${teamId === null ? "empty" : "filled"} ${
        isConflictCell ? "conflict" : ""
      } ${isEnabled && teamId !== null ? "draggable" : ""} ${
        isDragging ? "dragging" : ""
      } ${isOver && isEnabled ? "droppable-over" : ""}`}
      {...(isEnabled && teamId !== null ? attributes : {})}
      {...(isEnabled && teamId !== null ? listeners : {})}
    >
      {teamId === null ? EMPTY_CELL_LABEL : String(teamId)}
    </div>
  );
}

function App() {
  const [setup, setSetup] = useState<TournamentSetup>(DEFAULT_SETUP);
  const [scheduleResult, setScheduleResult] =
    useState<GenerateScheduleResult | null>(null);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("teams");
  const [editMode, setEditMode] = useState<EditMode>("manual");
  const [scheduleConflicts, setScheduleConflicts] = useState<
    ScheduleConflict[] | null
  >(null);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [autoReshuffleError, setAutoReshuffleError] =
    useState<AutoReshuffleFailureReason | null>(null);
  const [savedSetups, setSavedSetups] = useState<SetupSummary[]>([]);
  const [setupName, setSetupName] = useState("");
  const [selectedSetupId, setSelectedSetupId] = useState("");

  const setupRepository = useMemo(
    () => createLocalStorageSetupRepository(),
    []
  );

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
    setScheduleConflicts(null);
    setScheduleDirty(false);
    setAutoReshuffleError(null);
  };

  const handleValidateSchedule = () => {
    if (!scheduleResult || !scheduleResult.ok) return;
    const conflicts = validateSchedule(
      setup,
      scheduleResult.schedule.slots,
      scheduleResult.schedule.assignments
    );
    setScheduleConflicts(conflicts);
    setScheduleDirty(false);
    setAutoReshuffleError(null);
  };

  const resetScheduleState = useCallback(() => {
    setScheduleResult(null);
    setScheduleConflicts(null);
    setScheduleDirty(false);
    setAutoReshuffleError(null);
  }, []);

  useEffect(() => {
    const setups = setupRepository.list();
    setSavedSetups(setups);

    const lastOpened = setupRepository.getLastOpened();
    if (lastOpened) {
      const storedSetup = setupRepository.load(lastOpened);
      if (storedSetup) {
        setSetup(storedSetup);
        setSelectedSetupId(lastOpened);
        resetScheduleState();
      }
    }
  }, [resetScheduleState, setupRepository]);

  const handleSaveSetup = () => {
    const id = setupRepository.save(setup, setupName);
    setupRepository.setLastOpened(id);
    setSavedSetups(setupRepository.list());
    setSelectedSetupId(id);
    setSetupName("");
  };

  const handleLoadSetup = () => {
    if (!selectedSetupId) return;
    const storedSetup = setupRepository.load(selectedSetupId);
    if (!storedSetup) return;
    setSetup(storedSetup);
    setupRepository.setLastOpened(selectedSetupId);
    resetScheduleState();
  };

  const handleDeleteSetup = () => {
    if (!selectedSetupId) return;
    setupRepository.remove(selectedSetupId);
    const nextSetups = setupRepository.list();
    setSavedSetups(nextSetups);
    setSelectedSetupId("");
  };

  useEffect(() => {
    if (scheduleResult && scheduleResult.ok) {
      setActiveTab("teams");
    }
  }, [scheduleResult]);

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

  const visibleSuggestions =
    scheduleResult && !scheduleResult.ok
      ? scheduleResult.suggestions.filter((suggestion) =>
          shouldShowSuggestion(suggestion, setup)
        )
      : [];

  const scheduleGridRows = useMemo(() => {
    if (!scheduleResult || !scheduleResult.ok) return null;
    return {
      robot: buildGridRows(
        scheduleResult.schedule.slots,
        scheduleResult.schedule.assignments,
        Track.ROBOT,
        "tableIds"
      ),
      presentation: buildGridRows(
        scheduleResult.schedule.slots,
        scheduleResult.schedule.assignments,
        Track.PRESENTATION,
        "roomIds"
      ),
    };
  }, [scheduleResult]);

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

  const conflictTeamIds = useMemo(() => {
    if (!scheduleConflicts || scheduleConflicts.length === 0) {
      return new Set<number>();
    }
    return new Set(scheduleConflicts.flatMap((conflict) => conflict.teamIds));
  }, [scheduleConflicts]);

  const conflictCellKeys = useMemo(() => {
    if (!scheduleConflicts || !scheduleResult || !scheduleResult.ok) {
      return new Set<string>();
    }
    const keys = new Set<string>();
    const assignments = scheduleResult.schedule.assignments;
    for (const conflict of scheduleConflicts) {
      const teamSet = new Set(conflict.teamIds);
      const slotSet = new Set(conflict.slotIds);
      for (const assignment of assignments) {
        if (teamSet.size > 0 && !teamSet.has(assignment.teamId)) continue;
        if (slotSet.size > 0 && !slotSet.has(assignment.slotId)) continue;
        keys.add(
          `${assignment.slotId}::${normalizeResourceId(assignment.resourceId)}`
        );
      }
    }
    return keys;
  }, [scheduleConflicts, scheduleResult]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handlePresentationDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!scheduleResult || !scheduleResult.ok) return;
      const activeData = event.active.data.current as
        | PresentationDragData
        | undefined;
      const overData = event.over?.data.current as
        | PresentationDropData
        | undefined;
      if (!activeData || !overData) return;
      if (
        activeData.slotId === overData.slotId &&
        activeData.resourceId === overData.resourceId
      ) {
        return;
      }
      if (editMode === "manual") {
        setScheduleResult((prev) => {
          if (!prev || !prev.ok) return prev;
          const nextAssignments = applyPresentationMove(
            prev.schedule.assignments,
            activeData,
            overData
          );

          return {
            ...prev,
            schedule: {
              ...prev.schedule,
              assignments: nextAssignments,
            },
          };
        });
        setScheduleConflicts(null);
        setScheduleDirty(true);
        setAutoReshuffleError(null);
        return;
      }

      const move: PresentationMove = {
        type: "presentation",
        active: activeData,
        over: overData,
      };
      const result = autoReshuffle(scheduleResult.schedule, setup, move);
      if (!result.ok) {
        setAutoReshuffleError(result.reason);
        return;
      }

      setScheduleResult((prev) => {
        if (!prev || !prev.ok) return prev;
        return {
          ...prev,
          schedule: result.schedule,
        };
      });
      setScheduleConflicts(null);
      setScheduleDirty(false);
      setAutoReshuffleError(null);
    },
    [editMode, scheduleResult, setup]
  );

  const handleRobotDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!scheduleResult || !scheduleResult.ok) return;
      const activeData = event.active.data.current as
        | RobotDragData
        | undefined;
      const overData = event.over?.data.current as RobotDropData | undefined;
      if (!activeData || !overData) return;
      if (
        activeData.slotId === overData.slotId &&
        activeData.tableId === overData.tableId
      ) {
        return;
      }
      if (editMode === "manual") {
        const slot = scheduleResult.schedule.slots.find(
          (candidate) =>
            candidate.id === overData.slotId && candidate.track === Track.ROBOT
        );
        const tableIds = slot?.resources.tableIds ?? [];
        if (!slot || !tableIds.includes(overData.tableId)) {
          return;
        }

        setScheduleResult((prev) => {
          if (!prev || !prev.ok) return prev;
          const nextAssignments = applyRobotMove(
            prev.schedule.assignments,
            activeData,
            overData,
            prev.schedule.slots
          );

          return {
            ...prev,
            schedule: {
              ...prev.schedule,
              assignments: nextAssignments,
            },
          };
        });
        setScheduleConflicts(null);
        setScheduleDirty(true);
        setAutoReshuffleError(null);
        return;
      }

      const move = {
        type: "robot",
        active: activeData,
        over: overData,
      } as const;
      const result = autoReshuffle(scheduleResult.schedule, setup, move);
      if (!result.ok) {
        setAutoReshuffleError(result.reason);
        return;
      }

      setScheduleResult((prev) => {
        if (!prev || !prev.ok) return prev;
        return {
          ...prev,
          schedule: result.schedule,
        };
      });
      setScheduleConflicts(null);
      setScheduleDirty(false);
      setAutoReshuffleError(null);
    },
    [editMode, scheduleResult, setup]
  );

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
          <h2>Settings</h2>
          <div className="field-grid setup-storage">
            <div className="field">
              <label htmlFor="setup-name">Setup name (optional)</label>
              <input
                id="setup-name"
                type="text"
                placeholder="Add a label for this setup"
                value={setupName}
                onChange={(event) => setSetupName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="setup-load">Load setup</label>
              <select
                id="setup-load"
                value={selectedSetupId}
                onChange={(event) => setSelectedSetupId(event.target.value)}
                disabled={savedSetups.length === 0}
              >
                <option value="">Select saved setup</option>
                {savedSetups.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="setup-actions">
            <button type="button" onClick={handleSaveSetup}>
              Save setup
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handleLoadSetup}
              disabled={!selectedSetupId}
            >
              Load setup
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handleDeleteSetup}
              disabled={!selectedSetupId}
            >
              Delete setup
            </button>
            <p className="hint">Saved setups stay in this browser only.</p>
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
                <div className="panel-title">Schedule views</div>
                <div className="schedule-toolbar">
                  <div className="mode-switch">
                    <span className="mode-label">Editing mode</span>
                    <div className="mode-buttons" role="group" aria-label="Editing mode">
                      <button
                        type="button"
                        className={`mode-button ${
                          editMode === "manual" ? "active" : ""
                        }`}
                        aria-pressed={editMode === "manual"}
                        onClick={() => {
                          setEditMode("manual");
                          setAutoReshuffleError(null);
                        }}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        className={`mode-button ${
                          editMode === "auto" ? "active" : ""
                        }`}
                        aria-pressed={editMode === "auto"}
                        onClick={() => {
                          setEditMode("auto");
                          setAutoReshuffleError(null);
                        }}
                      >
                        Auto-reshuffle
                      </button>
                    </div>
                  </div>
                  <div className="validate-block">
                    <button
                      type="button"
                      className="ghost"
                      onClick={handleValidateSchedule}
                    >
                      Validate schedule
                    </button>
                    {scheduleConflicts && (
                      <span className="hint">
                        {scheduleConflicts.length === 0
                          ? "No conflicts detected."
                          : `${scheduleConflicts.length} conflict${
                              scheduleConflicts.length === 1 ? "" : "s"
                            } detected.`}
                      </span>
                    )}
                    {scheduleResult &&
                      scheduleResult.ok &&
                      scheduleConflicts === null &&
                      scheduleDirty && (
                        <span className="hint">Manual changes pending validation.</span>
                      )}
                    {autoReshuffleError && (
                      <span className="hint">
                        Auto-reshuffle failed ({autoReshuffleError.code}):{" "}
                        {autoReshuffleError.message}
                      </span>
                    )}
                  </div>
                </div>
                <div className="tab-bar" role="tablist" aria-label="Schedule views">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "teams"}
                    className={`tab-button ${activeTab === "teams" ? "active" : ""}`}
                    onClick={() => setActiveTab("teams")}
                  >
                    Teams
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "robots"}
                    className={`tab-button ${activeTab === "robots" ? "active" : ""}`}
                    onClick={() => setActiveTab("robots")}
                  >
                    Robot track
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "presentations"}
                    className={`tab-button ${
                      activeTab === "presentations" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("presentations")}
                  >
                    Presentation track
                  </button>
                </div>

                {scheduleConflicts && (
                  <div className="panel conflicts">
                    <div className="panel-title">Conflicts</div>
                    {scheduleConflicts.length === 0 ? (
                      <p className="hint">No conflicts detected.</p>
                    ) : (
                      <ul>
                        {scheduleConflicts.map((conflict, index) => (
                          <li key={`${conflict.type}-${index}`}>
                            {conflict.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {activeTab === "teams" && (
                  <>
                    <div className="schedule-view-title">Team schedule</div>
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
                              <tr
                                key={row.teamId}
                                className={
                                  conflictTeamIds.has(row.teamId)
                                    ? "conflict-row"
                                    : ""
                                }
                              >
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
                  </>
                )}

                {activeTab === "robots" && (
                  <>
                    <div className="schedule-view-title">Robot grid</div>
                    {scheduleGridRows && scheduleGridRows.robot.length === 0 ? (
                      <p className="hint">No robot slots available.</p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        onDragEnd={handleRobotDragEnd}
                        collisionDetection={pointerWithin}
                      >
                        <div
                          className="schedule-grid"
                          role="region"
                          aria-label="Robot grid"
                        >
                          {scheduleGridRows?.robot.map((row) => (
                            <div className="grid-row" key={row.slotId}>
                              <div className="grid-row-label">
                                {row.timeLabel}
                              </div>
                              <div
                                className="grid-row-head"
                                style={{
                                  gridTemplateColumns: `repeat(${row.cells.length}, minmax(80px, 1fr))`,
                                }}
                              >
                                {row.cells.map((cell) => (
                                  <div
                                    key={`${row.slotId}-header-${cell.resourceId}`}
                                    className="grid-header-cell"
                                  >
                                    Table {cell.resourceId}
                                  </div>
                                ))}
                              </div>
                              <div
                                className="grid-row-cells"
                                style={{
                                  gridTemplateColumns: `repeat(${row.cells.length}, minmax(80px, 1fr))`,
                                }}
                              >
                                {row.cells.map((cell) => {
                                  const cellKey = `${row.slotId}::${normalizeResourceId(
                                    cell.resourceId
                                  )}`;
                                  const isConflictCell =
                                    (cell.teamId !== null &&
                                      conflictTeamIds.has(cell.teamId)) ||
                                    conflictCellKeys.has(cellKey);
                                  return (
                                    <RobotGridCell
                                      key={`${row.slotId}-cell-${cell.resourceId}`}
                                      slotId={row.slotId}
                                      resourceId={cell.resourceId}
                                      teamId={cell.teamId}
                                      isConflictCell={isConflictCell}
                                      isEnabled={editMode === "manual" || editMode === "auto"}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </DndContext>
                    )}
                  </>
                )}

                {activeTab === "presentations" && (
                  <>
                    <div className="schedule-view-title">Presentation grid</div>
                    {scheduleGridRows &&
                    scheduleGridRows.presentation.length === 0 ? (
                      <p className="hint">No presentation slots available.</p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        onDragEnd={handlePresentationDragEnd}
                        collisionDetection={pointerWithin}
                      >
                        <div
                          className="schedule-grid"
                          role="region"
                          aria-label="Presentation grid"
                        >
                          {scheduleGridRows?.presentation.map((row) => (
                            <div className="grid-row" key={row.slotId}>
                              <div className="grid-row-label">
                                {row.timeLabel}
                              </div>
                              <div
                                className="grid-row-head"
                                style={{
                                  gridTemplateColumns: `repeat(${row.cells.length}, minmax(80px, 1fr))`,
                                }}
                              >
                                {row.cells.map((cell) => (
                                  <div
                                    key={`${row.slotId}-header-${cell.resourceId}`}
                                    className="grid-header-cell"
                                  >
                                    Room {cell.resourceId}
                                  </div>
                                ))}
                              </div>
                              <div
                                className="grid-row-cells"
                                style={{
                                  gridTemplateColumns: `repeat(${row.cells.length}, minmax(80px, 1fr))`,
                                }}
                              >
                                {row.cells.map((cell) => {
                                  const cellKey = `${row.slotId}::${normalizeResourceId(
                                    cell.resourceId
                                  )}`;
                                  const isConflictCell =
                                    (cell.teamId !== null &&
                                      conflictTeamIds.has(cell.teamId)) ||
                                    conflictCellKeys.has(cellKey);
                                  return (
                                    <PresentationGridCell
                                      key={`${row.slotId}-cell-${cell.resourceId}`}
                                      slotId={row.slotId}
                                      resourceId={cell.resourceId}
                                      teamId={cell.teamId}
                                      isConflictCell={isConflictCell}
                                      isEnabled={editMode === "manual" || editMode === "auto"}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </DndContext>
                    )}
                  </>
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
                {visibleSuggestions.length === 0 ? (
                  <p className="hint">No suggestions available yet.</p>
                ) : (
                  <ul>
                    {visibleSuggestions.map((suggestion, index) => (
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
