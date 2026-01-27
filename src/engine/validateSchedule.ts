import { diffMinutes, overlaps, withinWindow } from "../domain";
import {
  AssignmentType,
  ScheduleConflictType,
} from "../domain";
import type {
  Assignment,
  ScheduleConflict,
  Slot,
  TeamId,
  TimeWindow,
  TournamentSetup,
} from "../domain";

interface TeamEvent {
  assignment: Assignment;
  slot: Slot;
  window: TimeWindow;
}

function normalizeResourceId(resourceId: string): string {
  return String(resourceId).trim();
}

function resourceMatches(
  allowed: number[] | undefined,
  resourceId: string
): boolean {
  if (!allowed || allowed.length === 0) return false;
  const normalized = normalizeResourceId(resourceId);
  return allowed.some((id) => String(id) === normalized);
}

function buildConflict(
  type: ScheduleConflictType,
  message: string,
  teamIds: TeamId[],
  slotIds: string[],
  resourceIds: string[]
): ScheduleConflict {
  return {
    type,
    message,
    teamIds,
    slotIds,
    resourceIds,
  };
}

function trackLabel(type: Assignment["type"]): string {
  return type === AssignmentType.ROBOT_MATCH ? "robot" : "presentation";
}

export function validateSchedule(
  setup: TournamentSetup,
  slots: Slot[],
  assignments: Assignment[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const slotById = new Map<string, Slot>(slots.map((slot) => [slot.id, slot]));
  const eventsByTeam = new Map<TeamId, TeamEvent[]>();
  const assignmentsByResource = new Map<string, Assignment[]>();

  const robotWindow = {
    startMs: setup.robotStartMs,
    endMs: setup.robotEndMs,
  };
  const presentationWindow = {
    startMs: setup.presentationStartMs,
    endMs: setup.presentationEndMs,
  };

  for (const assignment of assignments) {
    const slot = slotById.get(assignment.slotId);
    const normalizedResource = normalizeResourceId(assignment.resourceId);

    if (!slot) {
      conflicts.push(
        buildConflict(
          ScheduleConflictType.OUTSIDE_WINDOW,
          `Team ${assignment.teamId} assignment references unknown slot ${assignment.slotId}.`,
          [assignment.teamId],
          [assignment.slotId],
          [normalizedResource]
        )
      );
      continue;
    }

    const window = { startMs: slot.startMs, endMs: slot.endMs };
    const isRobot = assignment.type === AssignmentType.ROBOT_MATCH;
    const trackWindow = isRobot ? robotWindow : presentationWindow;
    const trackBreaks = isRobot ? setup.robotBreaks : setup.presentationBreaks;

    if (!withinWindow(window, trackWindow)) {
      conflicts.push(
        buildConflict(
          ScheduleConflictType.OUTSIDE_WINDOW,
          `Team ${assignment.teamId} ${trackLabel(
            assignment.type
          )} event in slot ${slot.id} is outside the ${trackLabel(
            assignment.type
          )} window.`,
          [assignment.teamId],
          [slot.id],
          [normalizedResource]
        )
      );
    }

    const inBreak = trackBreaks.some((breakWindow) =>
      overlaps(window, breakWindow),
    );
    if (inBreak) {
      conflicts.push(
        buildConflict(
          ScheduleConflictType.IN_BREAK,
          `Team ${assignment.teamId} ${trackLabel(
            assignment.type
          )} event in slot ${slot.id} is during a break.`,
          [assignment.teamId],
          [slot.id],
          [normalizedResource]
        )
      );
    }

    const allowedResources = isRobot
      ? slot.resources.tableIds
      : slot.resources.roomIds;
    if (!resourceMatches(allowedResources, normalizedResource)) {
      conflicts.push(
        buildConflict(
          ScheduleConflictType.DOUBLE_BOOK_RESOURCE,
          `Team ${assignment.teamId} is assigned to resource ${normalizedResource} not available in slot ${slot.id}.`,
          [assignment.teamId],
          [slot.id],
          [normalizedResource]
        )
      );
    }

    const event: TeamEvent = { assignment, slot, window };
    const events = eventsByTeam.get(assignment.teamId);
    if (events) {
      events.push(event);
    } else {
      eventsByTeam.set(assignment.teamId, [event]);
    }

    const resourceKey = `${assignment.slotId}::${normalizedResource}`;
    const resourceAssignments = assignmentsByResource.get(resourceKey);
    if (resourceAssignments) {
      resourceAssignments.push(assignment);
    } else {
      assignmentsByResource.set(resourceKey, [assignment]);
    }
  }

  for (const [key, resourceAssignments] of assignmentsByResource.entries()) {
    if (resourceAssignments.length <= 1) {
      continue;
    }
    const [slotId, resourceId] = key.split("::");
    const teamIds = resourceAssignments.map((assignment) => assignment.teamId);
    conflicts.push(
      buildConflict(
        ScheduleConflictType.DOUBLE_BOOK_RESOURCE,
        `Resource ${resourceId} is assigned to multiple teams in slot ${slotId}.`,
        teamIds,
        [slotId],
        [resourceId]
      )
    );
  }

  for (const [teamId, events] of eventsByTeam.entries()) {
    const sorted = [...events].sort(
      (a, b) => a.window.startMs - b.window.startMs,
    );

    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      for (let j = i + 1; j < sorted.length; j += 1) {
        const next = sorted[j];
        if (next.window.startMs >= current.window.endMs) {
          break;
        }
        if (overlaps(current.window, next.window)) {
          conflicts.push(
            buildConflict(
              ScheduleConflictType.OVERLAP,
              `Team ${teamId} events overlap between slots ${current.slot.id} and ${next.slot.id}.`,
              [teamId],
              [current.slot.id, next.slot.id],
              [
                normalizeResourceId(current.assignment.resourceId),
                normalizeResourceId(next.assignment.resourceId),
              ]
            )
          );
        }
      }
    }

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      if (current.window.startMs < previous.window.endMs) {
        continue;
      }
      const gapMinutes = diffMinutes(
        previous.window.endMs,
        current.window.startMs,
      );
      if (gapMinutes < setup.minGapMinutes) {
        conflicts.push(
          buildConflict(
            ScheduleConflictType.MIN_GAP,
            `Team ${teamId} gap between events is ${Math.round(
              gapMinutes
            )} minutes; minimum is ${setup.minGapMinutes}.`,
            [teamId],
            [previous.slot.id, current.slot.id],
            [
              normalizeResourceId(previous.assignment.resourceId),
              normalizeResourceId(current.assignment.resourceId),
            ]
          )
        );
      }
    }
  }

  return conflicts;
}
