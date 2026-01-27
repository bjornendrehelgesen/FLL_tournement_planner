import type {
  Assignment,
  DomainError,
  EpochMs,
  GenerateScheduleResult,
  Slot,
  SuggestionAction,
  TeamId,
  TournamentSetup,
} from "../domain";
import { AssignmentType, Track, diffMinutes, overlaps } from "../domain";
import { capacityCheck } from "./feasibility/capacityCheck";
import { presentationSlots } from "./slots/presentationSlots";
import { robotSlots } from "./slots/robotSlots";
import { validateSetup } from "./validateSetup";

const MIN_GAP_FLOOR_MINUTES = 15;
const MATCHES_PER_TEAM = 3;

type ConstraintFailureReason = "overlap" | "gap";

interface TeamCalendarEvent {
  startMs: EpochMs;
  endMs: EpochMs;
  slotId: string;
  type: Assignment["type"];
  resourceId: string;
}

interface PlacementResult {
  ok: boolean;
  index?: number;
  reason?: ConstraintFailureReason;
}

function buildFeasibilityError(
  code: DomainError["code"],
  message: string,
  path?: string,
  meta?: Record<string, unknown>,
): DomainError {
  return {
    code,
    message,
    path,
    kind: "FEASIBILITY",
    meta,
  };
}

function buildConstraintSuggestions(
  setup: TournamentSetup,
  track: Track,
): SuggestionAction[] {
  const suggestions: SuggestionAction[] = [];

  if (track === Track.ROBOT) {
    suggestions.push({ action: "INCREASE_ROBOT_TABLES" });
    suggestions.push({ action: "EXTEND_ROBOT_END_TIME" });
  } else {
    suggestions.push({ action: "INCREASE_PRESENTATION_ROOMS" });
    suggestions.push({ action: "EXTEND_PRESENTATION_END_TIME" });
  }

  if (setup.minGapMinutes > MIN_GAP_FLOOR_MINUTES) {
    suggestions.push({
      action: "REDUCE_MIN_GAP",
      minutes: MIN_GAP_FLOOR_MINUTES,
    });
  }

  return suggestions;
}

function getCalendar(
  calendars: Map<TeamId, TeamCalendarEvent[]>,
  teamId: TeamId,
): TeamCalendarEvent[] {
  const existing = calendars.get(teamId);
  if (existing) return existing;
  const created: TeamCalendarEvent[] = [];
  calendars.set(teamId, created);
  return created;
}

function findInsertionIndex(
  events: TeamCalendarEvent[],
  startMs: EpochMs,
): number {
  let index = 0;
  while (index < events.length && events[index].startMs < startMs) {
    index += 1;
  }
  return index;
}

function canPlaceInCalendar(
  events: TeamCalendarEvent[],
  window: { startMs: EpochMs; endMs: EpochMs },
  minGapMinutes: number,
): PlacementResult {
  const index = findInsertionIndex(events, window.startMs);
  const previous = index > 0 ? events[index - 1] : null;
  const next = index < events.length ? events[index] : null;

  if (previous) {
    if (overlaps(window, previous)) {
      return { ok: false, reason: "overlap" };
    }
    const gap = diffMinutes(previous.endMs, window.startMs);
    if (gap < minGapMinutes) {
      return { ok: false, reason: "gap" };
    }
  }

  if (next) {
    if (overlaps(window, next)) {
      return { ok: false, reason: "overlap" };
    }
    const gap = diffMinutes(window.endMs, next.startMs);
    if (gap < minGapMinutes) {
      return { ok: false, reason: "gap" };
    }
  }

  return { ok: true, index };
}

function insertCalendarEvent(
  calendars: Map<TeamId, TeamCalendarEvent[]>,
  teamId: TeamId,
  event: TeamCalendarEvent,
  index: number,
): void {
  const events = getCalendar(calendars, teamId);
  events.splice(index, 0, event);
}

function buildCalendarEvent(
  assignment: Assignment,
  slot: Slot,
): TeamCalendarEvent {
  return {
    startMs: slot.startMs,
    endMs: slot.endMs,
    slotId: slot.id,
    type: assignment.type,
    resourceId: assignment.resourceId,
  };
}

function sortTeams(teams: TournamentSetup["teams"]): TournamentSetup["teams"] {
  return [...teams].sort((a, b) => a.id - b.id);
}

function sortSlots(slots: Slot[], track: Track): Slot[] {
  return [...slots]
    .filter((slot) => slot.track === track)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

export function generateSchedule(setup: TournamentSetup): GenerateScheduleResult {
  const validation = validateSetup(setup);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, suggestions: [] };
  }

  const capacityResult = capacityCheck(setup);
  if (!capacityResult.ok) {
    return {
      ok: false,
      errors: capacityResult.errors,
      suggestions: capacityResult.suggestions,
    };
  }

  const robotSlotsList = robotSlots({
    robotStartMs: setup.robotStartMs,
    robotEndMs: setup.robotEndMs,
    robotTablesCount: setup.robotTablesCount,
    robotBreaks: setup.robotBreaks,
  });
  const presentationSlotsList = presentationSlots({
    presentationStartMs: setup.presentationStartMs,
    presentationEndMs: setup.presentationEndMs,
    presentationRoomsCount: setup.presentationRoomsCount,
    presentationBreaks: setup.presentationBreaks,
  });

  const slots = [...robotSlotsList, ...presentationSlotsList].sort(
    (a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id),
  );

  const calendars = new Map<TeamId, TeamCalendarEvent[]>();
  const assignments: Assignment[] = [];
  const orderedTeams = sortTeams(setup.teams);
  const orderedPresentationSlots = sortSlots(
    presentationSlotsList,
    Track.PRESENTATION,
  );
  const orderedRobotSlots = sortSlots(robotSlotsList, Track.ROBOT);
  const takenRoomsBySlot = new Map<string, Set<number>>();

  for (const team of orderedTeams) {
    let assigned = false;
    let sawGapFailure = false;
    let sawOverlapFailure = false;

    for (const slot of orderedPresentationSlots) {
      const roomIds = slot.resources.roomIds ?? [];
      if (roomIds.length === 0) continue;

      const takenRooms = takenRoomsBySlot.get(slot.id) ?? new Set<number>();
      const availableRoom = roomIds.find((roomId) => !takenRooms.has(roomId));
      if (availableRoom === undefined) {
        continue;
      }

      const placement = canPlaceInCalendar(
        getCalendar(calendars, team.id),
        { startMs: slot.startMs, endMs: slot.endMs },
        setup.minGapMinutes,
      );
      if (!placement.ok) {
        if (placement.reason === "gap") {
          sawGapFailure = true;
        } else {
          sawOverlapFailure = true;
        }
        continue;
      }

      takenRooms.add(availableRoom);
      takenRoomsBySlot.set(slot.id, takenRooms);

      const assignment: Assignment = {
        id: `presentation-${team.id}-${slot.id}-${availableRoom}`,
        teamId: team.id,
        type: AssignmentType.PRESENTATION,
        slotId: slot.id,
        resourceId: String(availableRoom),
        sequence: null,
      };

      assignments.push(assignment);
      insertCalendarEvent(
        calendars,
        team.id,
        buildCalendarEvent(assignment, slot),
        placement.index ?? 0,
      );
      assigned = true;
      break;
    }

    if (!assigned) {
      const code = sawGapFailure
        ? "NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS"
        : "UNSATISFIABLE_OVERLAP_CONSTRAINTS";
      return {
        ok: false,
        errors: [
          buildFeasibilityError(
            code,
            `Unable to assign a presentation slot for team ${team.id} with the current gap/overlap constraints.`,
            "presentationAssignments",
            { teamId: team.id },
          ),
        ],
        suggestions: buildConstraintSuggestions(setup, Track.PRESENTATION),
      };
    }
  }

  const usedRobotCells = new Set<string>();
  const robotCells: Array<{ slot: Slot; tableId: number }> = [];
  for (const slot of orderedRobotSlots) {
    const tableIds = [...(slot.resources.tableIds ?? [])].sort((a, b) => a - b);
    for (const tableId of tableIds) {
      robotCells.push({ slot, tableId });
    }
  }

  for (let sequence = 1; sequence <= MATCHES_PER_TEAM; sequence += 1) {
    for (const team of orderedTeams) {
      let assigned = false;
      let sawGapFailure = false;
      let sawOverlapFailure = false;

      for (const cell of robotCells) {
        const cellKey = `${cell.slot.id}::${cell.tableId}`;
        if (usedRobotCells.has(cellKey)) {
          continue;
        }

        const placement = canPlaceInCalendar(
          getCalendar(calendars, team.id),
          { startMs: cell.slot.startMs, endMs: cell.slot.endMs },
          setup.minGapMinutes,
        );
        if (!placement.ok) {
          if (placement.reason === "gap") {
            sawGapFailure = true;
          } else {
            sawOverlapFailure = true;
          }
          continue;
        }

        const assignment: Assignment = {
          id: `robot-${team.id}-${cell.slot.id}-${cell.tableId}-${sequence}`,
          teamId: team.id,
          type: AssignmentType.ROBOT_MATCH,
          slotId: cell.slot.id,
          resourceId: String(cell.tableId),
          sequence,
        };

        usedRobotCells.add(cellKey);
        assignments.push(assignment);
        insertCalendarEvent(
          calendars,
          team.id,
          buildCalendarEvent(assignment, cell.slot),
          placement.index ?? 0,
        );

        assigned = true;
        break;
      }

      if (!assigned) {
        const code = sawGapFailure
          ? "NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS"
          : "UNSATISFIABLE_OVERLAP_CONSTRAINTS";
        return {
          ok: false,
          errors: [
            buildFeasibilityError(
              code,
              `Unable to assign robot matches for team ${team.id} with the current gap/overlap constraints.`,
              "robotAssignments",
              { teamId: team.id, sequence },
            ),
          ],
          suggestions: buildConstraintSuggestions(setup, Track.ROBOT),
        };
      }
    }
  }

  return {
    ok: true,
    schedule: {
      slots,
      assignments,
      warnings: [],
    },
  };
}
