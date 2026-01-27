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
import {
  applyRobotMove,
  type RobotDragData,
  type RobotDropData,
} from "../robotDnd";

export type PresentationMove = {
  type: "presentation";
  active: PresentationDragData;
  over: PresentationDropData;
};

export type RobotMove = {
  type: "robot";
  active: RobotDragData;
  over: RobotDropData;
};

type AutoReshuffleErrorCode =
  | "BASE_CONFLICTS"
  | "UNSUPPORTED_MOVE"
  | "NO_ASSIGNMENT"
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

type RobotCell = {
  slotId: string;
  tableId: number;
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

function listRobotAssignments(assignments: Assignment[]): Assignment[] {
  return assignments.filter(
    (assignment) => assignment.type === AssignmentType.ROBOT_MATCH
  );
}

function getRobotCells(slots: Slot[]): RobotCell[] {
  const cells: RobotCell[] = [];
  for (const slot of slots) {
    if (slot.track !== Track.ROBOT) continue;
    const tableIds = slot.resources.tableIds ?? [];
    for (const tableId of tableIds) {
      cells.push({ slotId: slot.id, tableId, startMs: slot.startMs });
    }
  }
  return cells.sort((a, b) => a.startMs - b.startMs);
}

export function autoReshuffle(
  schedule: Schedule,
  setup: TournamentSetup,
  move: PresentationMove | RobotMove
): AutoReshuffleResult {
  if (move.type !== "presentation" && move.type !== "robot") {
    return {
      ok: false,
      reason: {
        code: "UNSUPPORTED_MOVE",
        message: "Only presentation or robot moves support auto-reshuffle.",
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

  if (move.type === "presentation") {
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
          code: "UNRESOLVABLE",
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
          message:
            "Unable to auto-reshuffle presentations to resolve conflicts.",
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
      const candidateKey = buildCellKey(
        candidate.slotId,
        candidate.resourceId
      );
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
        message:
          "Unable to auto-reshuffle presentations to resolve conflicts.",
      },
    };
  }

  const movedAssignment = schedule.assignments.find(
    (assignment) =>
      assignment.type === AssignmentType.ROBOT_MATCH &&
      assignment.slotId === move.active.slotId &&
      String(assignment.resourceId) === String(move.active.tableId)
  );

  const movedAssignments = applyRobotMove(
    schedule.assignments,
    move.active,
    move.over,
    schedule.slots
  );
  if (movedAssignments === schedule.assignments || !movedAssignment) {
    return {
      ok: false,
      reason: {
        code: "NO_ASSIGNMENT",
        message: "No robot assignment found to move.",
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

  const conflictTeamIds = new Set<TeamId>(
    conflicts.flatMap((conflict) => conflict.teamIds)
  );
  const robotAssignments = listRobotAssignments(movedAssignments);
  const robotCandidates = robotAssignments.filter(
    (assignment) =>
      conflictTeamIds.has(assignment.teamId) &&
      assignment.id !== movedAssignment.id
  );
  const robotCells = getRobotCells(schedule.slots);
  const robotOccupied = new Set(
    robotAssignments.map((assignment) =>
      buildCellKey(assignment.slotId, assignment.resourceId)
    )
  );

  for (const candidate of robotCandidates) {
    const candidateKey = buildCellKey(
      candidate.slotId,
      candidate.resourceId
    );
    for (const cell of robotCells) {
      const cellKey = buildCellKey(cell.slotId, cell.tableId);
      if (cellKey === candidateKey) continue;
      if (robotOccupied.has(cellKey) && cellKey !== candidateKey) continue;

      const nextAssignments = movedAssignments.map((assignment) =>
        assignment.id === candidate.id
          ? {
              ...assignment,
              slotId: cell.slotId,
              resourceId: String(cell.tableId),
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

  // Robot auto-reshuffle is bounded: try moving one other robot match first.
  // Only if conflicts involve presentations do we attempt a single presentation move.
  const slotById = new Map(schedule.slots.map((slot) => [slot.id, slot]));
  const hasPresentationConflict = conflicts.some((conflict) =>
    conflict.slotIds.some(
      (slotId) => slotById.get(slotId)?.track === Track.PRESENTATION
    )
  );
  if (!hasPresentationConflict) {
    return {
      ok: false,
      reason: {
        code: "UNRESOLVABLE",
        message: "Unable to auto-reshuffle robot matches to resolve conflicts.",
      },
    };
  }

  const presentationAssignments = listPresentationAssignments(movedAssignments);
  const presentationCandidates = presentationAssignments.filter((assignment) =>
    conflictTeamIds.has(assignment.teamId)
  );
  const presentationCells = getPresentationCells(schedule.slots);
  const presentationOccupied = new Set(
    presentationAssignments.map((assignment) =>
      buildCellKey(assignment.slotId, assignment.resourceId)
    )
  );

  for (const candidate of presentationCandidates) {
    const candidateKey = buildCellKey(
      candidate.slotId,
      candidate.resourceId
    );
    for (const cell of presentationCells) {
      const cellKey = buildCellKey(cell.slotId, cell.resourceId);
      if (cellKey === candidateKey) continue;
      if (presentationOccupied.has(cellKey) && cellKey !== candidateKey) continue;

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
      message: "Unable to auto-reshuffle robot matches to resolve conflicts.",
    },
  };
}
