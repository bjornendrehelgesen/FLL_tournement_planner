import { describe, expect, it } from "vitest";
import { applyPresentationMove } from "./presentationDnd";
import { AssignmentType } from "./domain";

describe("applyPresentationMove", () => {
  it("moves a presentation assignment into an empty cell", () => {
    const assignments = [
      {
        id: "presentation-1",
        teamId: 1,
        type: AssignmentType.PRESENTATION,
        slotId: "PRESENTATION-1",
        resourceId: "1",
        sequence: null,
      },
    ];

    const updated = applyPresentationMove(
      assignments,
      {
        type: "presentation",
        slotId: "PRESENTATION-1",
        resourceId: 1,
        teamId: 1,
      },
      { type: "presentation", slotId: "PRESENTATION-1", resourceId: 2 }
    );

    expect(updated[0]).toMatchObject({
      slotId: "PRESENTATION-1",
      resourceId: "2",
    });
  });

  it("swaps presentation assignments when the target is occupied", () => {
    const assignments = [
      {
        id: "presentation-1",
        teamId: 1,
        type: AssignmentType.PRESENTATION,
        slotId: "PRESENTATION-1",
        resourceId: "1",
        sequence: null,
      },
      {
        id: "presentation-2",
        teamId: 2,
        type: AssignmentType.PRESENTATION,
        slotId: "PRESENTATION-1",
        resourceId: "2",
        sequence: null,
      },
    ];

    const updated = applyPresentationMove(
      assignments,
      {
        type: "presentation",
        slotId: "PRESENTATION-1",
        resourceId: 1,
        teamId: 1,
      },
      { type: "presentation", slotId: "PRESENTATION-1", resourceId: 2 }
    );

    expect(updated[0]).toMatchObject({
      slotId: "PRESENTATION-1",
      resourceId: "2",
      teamId: 1,
    });
    expect(updated[1]).toMatchObject({
      slotId: "PRESENTATION-1",
      resourceId: "1",
      teamId: 2,
    });
  });

  it("keeps other assignments intact when moving", () => {
    const assignments = [
      {
        id: "presentation-1",
        teamId: 1,
        type: AssignmentType.PRESENTATION,
        slotId: "PRESENTATION-1",
        resourceId: "1",
        sequence: null,
      },
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-1",
        resourceId: "1",
        sequence: 1,
      },
    ];

    const updated = applyPresentationMove(
      assignments,
      {
        type: "presentation",
        slotId: "PRESENTATION-1",
        resourceId: 1,
        teamId: 1,
      },
      { type: "presentation", slotId: "PRESENTATION-2", resourceId: 1 }
    );

    expect(updated[1]).toEqual(assignments[1]);
  });
});
