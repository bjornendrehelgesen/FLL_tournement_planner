import { describe, expect, it } from "vitest";
import { validateSchedule } from "../validateSchedule";
import {
  AssignmentType,
  ScheduleConflictType,
  Track,
  type Assignment,
  type Slot,
  type TournamentSetup,
} from "../../domain";

const MINUTE_MS = 60_000;

function buildSetup(overrides: Partial<TournamentSetup>): TournamentSetup {
  return {
    teams: [
      { id: 1, name: "Team 1" },
      { id: 2, name: "Team 2" },
    ],
    robotTablesCount: 2,
    robotStartMs: 0,
    robotEndMs: 60 * MINUTE_MS,
    robotBreaks: [],
    presentationRoomsCount: 1,
    presentationStartMs: 0,
    presentationEndMs: 60 * MINUTE_MS,
    presentationBreaks: [],
    minGapMinutes: 15,
    suggestBreaks: false,
    suggestResources: false,
    ...overrides,
  };
}

function buildSlot(
  id: string,
  track: Slot["track"],
  startMinutes: number,
  endMinutes: number,
  resources: Slot["resources"],
): Slot {
  return {
    id,
    track,
    startMs: startMinutes * MINUTE_MS,
    endMs: endMinutes * MINUTE_MS,
    resources,
  };
}

function buildAssignment(
  id: string,
  teamId: number,
  type: Assignment["type"],
  slotId: string,
  resourceId: string,
  sequence: number | null = null,
): Assignment {
  return {
    id,
    teamId,
    type,
    slotId,
    resourceId,
    sequence,
  };
}

describe("validateSchedule", () => {
  it("detects overlaps for a team", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("pres-5", Track.PRESENTATION, 5, 15, { roomIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
      buildAssignment(
        "a2",
        1,
        AssignmentType.PRESENTATION,
        "pres-5",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.OVERLAP);
  });

  it("detects min gap violations", () => {
    const setup = buildSetup({ minGapMinutes: 15 });
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("robot-20", Track.ROBOT, 20, 30, { tableIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
      buildAssignment(
        "a2",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-20",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.MIN_GAP);
  });

  it("detects resource double booking within a slot", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1, 2] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
      buildAssignment(
        "a2",
        2,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.DOUBLE_BOOK_RESOURCE);
  });

  it("detects invalid resource usage for a slot", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [2] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.DOUBLE_BOOK_RESOURCE);
  });

  it("detects assignments outside the track window", () => {
    const setup = buildSetup({ robotEndMs: 60 * MINUTE_MS });
    const slots = [
      buildSlot("robot-70", Track.ROBOT, 70, 80, { tableIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-70",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.OUTSIDE_WINDOW);
  });

  it("detects assignments during breaks", () => {
    const setup = buildSetup({
      robotBreaks: [{ startMs: 10 * MINUTE_MS, endMs: 20 * MINUTE_MS }],
    });
    const slots = [
      buildSlot("robot-10", Track.ROBOT, 10, 15, { tableIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-10",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(ScheduleConflictType.IN_BREAK);
  });

  it("returns multiple conflicts when present", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("pres-5", Track.PRESENTATION, 5, 15, { roomIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
      buildAssignment(
        "a2",
        1,
        AssignmentType.PRESENTATION,
        "pres-5",
        "1",
      ),
      buildAssignment(
        "a3",
        2,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);
    const types = conflicts.map((conflict) => conflict.type);

    expect(types).toEqual(
      expect.arrayContaining([
        ScheduleConflictType.OVERLAP,
        ScheduleConflictType.DOUBLE_BOOK_RESOURCE,
      ]),
    );
  });

  it("returns no conflicts for a valid schedule", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("robot-30", Track.ROBOT, 30, 40, { tableIds: [1] }),
      buildSlot("pres-10", Track.PRESENTATION, 10, 40, { roomIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
      ),
      buildAssignment(
        "a2",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-30",
        "1",
      ),
      buildAssignment(
        "a3",
        2,
        AssignmentType.PRESENTATION,
        "pres-10",
        "1",
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(0);
  });

  it("detects robot sequence ordering violations", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("robot-5", Track.ROBOT, 5, 15, { tableIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
        1,
      ),
      buildAssignment(
        "a2",
        2,
        AssignmentType.ROBOT_MATCH,
        "robot-5",
        "1",
        2,
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.type).toBe(
      ScheduleConflictType.ROBOT_SEQUENCE_ORDER_VIOLATION,
    );
    expect(conflicts[0]?.message).toBe(
      "Robot match 2 starts before all match 1 are completed.",
    );
  });

  it("allows sequence 2 to start when sequence 1 ends", () => {
    const setup = buildSetup({});
    const slots = [
      buildSlot("robot-0", Track.ROBOT, 0, 10, { tableIds: [1] }),
      buildSlot("robot-10", Track.ROBOT, 10, 20, { tableIds: [1] }),
    ];
    const assignments = [
      buildAssignment(
        "a1",
        1,
        AssignmentType.ROBOT_MATCH,
        "robot-0",
        "1",
        1,
      ),
      buildAssignment(
        "a2",
        2,
        AssignmentType.ROBOT_MATCH,
        "robot-10",
        "1",
        2,
      ),
    ];

    const conflicts = validateSchedule(setup, slots, assignments);

    expect(conflicts).toHaveLength(0);
  });
});
