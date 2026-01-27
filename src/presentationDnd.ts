import type { Assignment } from "./domain";
import { AssignmentType } from "./domain";

export type PresentationDragData = {
  type: "presentation";
  slotId: string;
  resourceId: number;
  teamId: number;
};

export type PresentationDropData = {
  type: "presentation";
  slotId: string;
  resourceId: number;
};

function buildPresentationCellKey(slotId: string, resourceId: number): string {
  return `${slotId}::${resourceId}`;
}

export function applyPresentationMove(
  assignments: Assignment[],
  activeData: PresentationDragData,
  overData: PresentationDropData
): Assignment[] {
  const sourceKey = buildPresentationCellKey(
    activeData.slotId,
    activeData.resourceId
  );
  const targetKey = buildPresentationCellKey(
    overData.slotId,
    overData.resourceId
  );
  const sourceIndex = assignments.findIndex(
    (assignment) =>
      assignment.type === AssignmentType.PRESENTATION &&
      buildPresentationCellKey(
        assignment.slotId,
        Number(assignment.resourceId)
      ) === sourceKey
  );
  if (sourceIndex === -1) return assignments;
  const targetIndex = assignments.findIndex(
    (assignment) =>
      assignment.type === AssignmentType.PRESENTATION &&
      buildPresentationCellKey(
        assignment.slotId,
        Number(assignment.resourceId)
      ) === targetKey
  );
  if (targetIndex === -1) {
    return assignments.map((assignment, index) =>
      index === sourceIndex
        ? {
            ...assignment,
            slotId: overData.slotId,
            resourceId: String(overData.resourceId),
          }
        : assignment
    );
  }

  return assignments.map((assignment, index) => {
    if (index === sourceIndex) {
      return {
        ...assignment,
        slotId: overData.slotId,
        resourceId: String(overData.resourceId),
      };
    }
    if (index === targetIndex) {
      return {
        ...assignment,
        slotId: activeData.slotId,
        resourceId: String(activeData.resourceId),
      };
    }
    return assignment;
  });
}
