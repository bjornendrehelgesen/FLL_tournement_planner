import { describe, expect, it } from "vitest";
import { applyRobotMove } from "./robotDnd";
import {
  AssignmentType,
  ScheduleConflictType,
  Track,
  type Slot,
  type TournamentSetup,
} from "./domain";
import { validateSchedule } from "./engine";

const MINUTE_MS = 60_000;

describe("applyRobotMove", () => {
  const slots: Slot[] = [
    {
      id: "ROBOT-0",
      track: Track.ROBOT,
      startMs: 0,
      endMs: 5 * MINUTE_MS,
      resources: { tableIds: [1, 2] },
    },
    {
      id: "ROBOT-5",
      track: Track.ROBOT,
      startMs: 5 * MINUTE_MS,
      endMs: 10 * MINUTE_MS,
      resources: { tableIds: [1, 2] },
    },
  ];

  it("moves a robot assignment into an empty cell", () => {
    const assignments = [
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-0",
        resourceId: "1",
        sequence: 1,
      },
    ];

    const updated = applyRobotMove(
      assignments,
      {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-5", tableId: 2 },
      slots
    );

    expect(updated[0]).toMatchObject({
      slotId: "ROBOT-5",
      resourceId: "2",
    });
  });

  it("swaps robot assignments when the target is occupied", () => {
    const assignments = [
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-0",
        resourceId: "1",
        sequence: 1,
      },
      {
        id: "robot-2",
        teamId: 2,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-5",
        resourceId: "2",
        sequence: 2,
      },
    ];

    const updated = applyRobotMove(
      assignments,
      {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-5", tableId: 2 },
      slots
    );

    expect(updated[0]).toMatchObject({
      slotId: "ROBOT-5",
      resourceId: "2",
      teamId: 1,
    });
    expect(updated[1]).toMatchObject({
      slotId: "ROBOT-0",
      resourceId: "1",
      teamId: 2,
    });
  });

  it("keeps the sequence attached to the assignment", () => {
    const assignments = [
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-0",
        resourceId: "1",
        sequence: 3,
      },
    ];

    const updated = applyRobotMove(
      assignments,
      {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-5", tableId: 2 },
      slots
    );

    expect(updated[0]).toMatchObject({
      slotId: "ROBOT-5",
      resourceId: "2",
      sequence: 3,
    });
  });

  it("rejects moves to tables that are not active for the slot", () => {
    const assignments = [
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-0",
        resourceId: "1",
        sequence: 1,
      },
    ];

    const updated = applyRobotMove(
      assignments,
      {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-0", tableId: 3 },
      slots
    );

    expect(updated).toEqual(assignments);
  });

  it("allows a move that creates a robot sequence order violation", () => {
    const sequenceSlots: Slot[] = [
      {
        id: "ROBOT-0",
        track: Track.ROBOT,
        startMs: 0,
        endMs: 10 * MINUTE_MS,
        resources: { tableIds: [1] },
      },
      {
        id: "ROBOT-10",
        track: Track.ROBOT,
        startMs: 10 * MINUTE_MS,
        endMs: 20 * MINUTE_MS,
        resources: { tableIds: [1] },
      },
    ];
    const setup: TournamentSetup = {
      teams: [{ id: 1, name: "Team 1" }],
      robotTablesCount: 1,
      robotStartMs: 0,
      robotEndMs: 30 * MINUTE_MS,
      robotBreaks: [],
      presentationRoomsCount: 1,
      presentationStartMs: 0,
      presentationEndMs: 30 * MINUTE_MS,
      presentationBreaks: [],
      minGapMinutes: 0,
      suggestBreaks: false,
      suggestResources: false,
    };
    const assignments = [
      {
        id: "robot-1",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-0",
        resourceId: "1",
        sequence: 1,
      },
      {
        id: "robot-2",
        teamId: 1,
        type: AssignmentType.ROBOT_MATCH,
        slotId: "ROBOT-10",
        resourceId: "1",
        sequence: 2,
      },
    ];

    const updated = applyRobotMove(
      assignments,
      {
        type: "robot",
        slotId: "ROBOT-10",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-0", tableId: 1 },
      sequenceSlots
    );
    const conflicts = validateSchedule(setup, sequenceSlots, updated);

    expect(
      conflicts.some(
        (conflict) =>
          conflict.type === ScheduleConflictType.ROBOT_SEQUENCE_ORDER_VIOLATION
      )
    ).toBe(true);
  });
});
