import type { Assignment, Slot } from "./domain";
import { AssignmentType, Track } from "./domain";

export type RobotDragData = {
  type: "robot";
  slotId: string;
  tableId: number;
  teamId: number;
};

export type RobotDropData = {
  type: "robot";
  slotId: string;
  tableId: number;
};

function buildRobotCellKey(slotId: string, tableId: number): string {
  return `${slotId}::${tableId}`;
}

function isValidRobotDrop(overData: RobotDropData, slots?: Slot[]): boolean {
  if (!slots) return true;
  const slot = slots.find(
    (candidate) => candidate.id === overData.slotId && candidate.track === Track.ROBOT
  );
  if (!slot) return false;
  const tableIds = slot.resources.tableIds ?? [];
  return tableIds.includes(overData.tableId);
}

export function applyRobotMove(
  assignments: Assignment[],
  activeData: RobotDragData,
  overData: RobotDropData,
  slots?: Slot[]
): Assignment[] {
  if (!isValidRobotDrop(overData, slots)) return assignments;
  const sourceKey = buildRobotCellKey(activeData.slotId, activeData.tableId);
  const targetKey = buildRobotCellKey(overData.slotId, overData.tableId);
  const sourceIndex = assignments.findIndex(
    (assignment) =>
      assignment.type === AssignmentType.ROBOT_MATCH &&
      buildRobotCellKey(assignment.slotId, Number(assignment.resourceId)) ===
        sourceKey
  );
  if (sourceIndex === -1) return assignments;
  const targetIndex = assignments.findIndex(
    (assignment) =>
      assignment.type === AssignmentType.ROBOT_MATCH &&
      buildRobotCellKey(assignment.slotId, Number(assignment.resourceId)) ===
        targetKey
  );
  if (targetIndex === -1) {
    return assignments.map((assignment, index) =>
      index === sourceIndex
        ? {
            ...assignment,
            slotId: overData.slotId,
            resourceId: String(overData.tableId),
          }
        : assignment
    );
  }

  return assignments.map((assignment, index) => {
    if (index === sourceIndex) {
      return {
        ...assignment,
        slotId: overData.slotId,
        resourceId: String(overData.tableId),
      };
    }
    if (index === targetIndex) {
      return {
        ...assignment,
        slotId: activeData.slotId,
        resourceId: String(activeData.tableId),
      };
    }
    return assignment;
  });
}
