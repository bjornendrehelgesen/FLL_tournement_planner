import type {
  Assignment,
  ResourceId,
  Schedule,
  Slot,
  TeamId,
  TournamentSetup,
} from "../domain";
import { AssignmentType, Track } from "../domain";
import { validateSchedule } from "./validateSchedule";
import {
  applyPresentationMove,
  type PresentationDragData,
  type PresentationDropData,
} from "../presentationDnd";

export type PresentationMove = {
  type: "presentation";
  active: PresentationDragData;
  over: PresentationDropData;
};

type AutoReshuffleErrorCode =
  | "BASE_CONFLICTS"
  | "UNSUPPORTED_MOVE"
  | "NO_ASSIGNMENT"
  | "MOVED_TEAM_CONFLICT"
  | "UNRESOLVABLE";

export type AutoReshuffleFailureReason = {
  code: AutoReshuffleErrorCode;
  message: string;
};

export type AutoReshuffleResult =
  | { ok: true; schedule: Schedule }
  | { ok: false; reason: AutoReshuffleFailureReason };

type PresentationCell = {
  slotId: string;
  resourceId: ResourceId;
  startMs: number;
};

function buildCellKey(slotId: string, resourceId: ResourceId): string {
  return `${slotId}::${String(resourceId)}`;
}

function getPresentationCells(slots: Slot[]): PresentationCell[] {
  const cells: PresentationCell[] = [];
  for (const slot of slots) {
    if (slot.track !== Track.PRESENTATION) continue;
    const roomIds = slot.resources.roomIds ?? [];
    for (const roomId of roomIds) {
      cells.push({
        slotId: slot.id,
        resourceId: String(roomId),
        startMs: slot.startMs,
      });
    }
  }
  return cells.sort((a, b) => a.startMs - b.startMs);
}

function listPresentationAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter(
    (assignment) => assignment.type === AssignmentType.PRESENTATION
  );
}

export function autoReshuffle(
  schedule: Schedule,
  setup: TournamentSetup,
  move: PresentationMove
): AutoReshuffleResult {
  if (move.type !== "presentation") {
    return {
      ok: false,
      reason: {
        code: "UNSUPPORTED_MOVE",
        message: "Only presentation moves support auto-reshuffle.",
      },
    };
  }

  const baseConflicts = validateSchedule(
    setup,
    schedule.slots,
    schedule.assignments
  );
  if (baseConflicts.length > 0) {
    return {
      ok: false,
      reason: {
        code: "BASE_CONFLICTS",
        message: "Resolve existing conflicts before auto-reshuffling.",
      },
    };
  }

  const movedAssignments = applyPresentationMove(
    schedule.assignments,
    move.active,
    move.over
  );
  if (movedAssignments === schedule.assignments) {
    return {
      ok: false,
      reason: {
        code: "NO_ASSIGNMENT",
        message: "No presentation assignment found to move.",
      },
    };
  }

  const conflicts = validateSchedule(
    setup,
    schedule.slots,
    movedAssignments
  );
  if (conflicts.length === 0) {
    return {
      ok: true,
      schedule: { ...schedule, assignments: movedAssignments },
    };
  }

  const movedTeamId = move.active.teamId;
  const conflictTeamIds = new Set<TeamId>(
    conflicts.flatMap((conflict) => conflict.teamIds)
  );
  if (conflictTeamIds.has(movedTeamId)) {
    return {
      ok: false,
      reason: {
        code: "MOVED_TEAM_CONFLICT",
        message: "Move creates conflicts for the moved team.",
      },
    };
  }

  const presentationAssignments = listPresentationAssignments(movedAssignments);
  const candidates = presentationAssignments.filter((assignment) =>
    conflictTeamIds.has(assignment.teamId)
  );
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: {
        code: "UNRESOLVABLE",
        message: "Unable to auto-reshuffle presentations to resolve conflicts.",
      },
    };
  }

  const cells = getPresentationCells(schedule.slots);
  const occupied = new Set(
    presentationAssignments.map((assignment) =>
      buildCellKey(assignment.slotId, assignment.resourceId)
    )
  );

  for (const candidate of candidates) {
    const candidateKey = buildCellKey(candidate.slotId, candidate.resourceId);
    for (const cell of cells) {
      const cellKey = buildCellKey(cell.slotId, cell.resourceId);
      if (cellKey === candidateKey) continue;
      if (occupied.has(cellKey) && cellKey !== candidateKey) continue;

      const nextAssignments = movedAssignments.map((assignment) =>
        assignment.id === candidate.id
          ? {
              ...assignment,
              slotId: cell.slotId,
              resourceId: String(cell.resourceId),
            }
          : assignment
      );

      const nextConflicts = validateSchedule(
        setup,
        schedule.slots,
        nextAssignments
      );
      if (nextConflicts.length === 0) {
        return {
          ok: true,
          schedule: { ...schedule, assignments: nextAssignments },
        };
      }
    }
  }

  return {
    ok: false,
    reason: {
      code: "UNRESOLVABLE",
      message: "Unable to auto-reshuffle presentations to resolve conflicts.",
    },
  };
}
