import { describe, expect, it } from "vitest";
import type { Assignment, Schedule, TournamentSetup } from "../../domain";
import { AssignmentType, Track } from "../../domain";
import { autoReshuffle } from "../autoReshuffle";
import { applyRobotMove } from "../../robotDnd";
import { validateSchedule } from "../validateSchedule";

const MINUTE_MS = 60_000;

function buildSetup(): TournamentSetup {
  return {
    teams: [{ id: 1 }, { id: 2 }],
    robotTablesCount: 1,
    robotStartMs: 0,
    robotEndMs: 150 * MINUTE_MS,
    robotBreaks: [],
    presentationRoomsCount: 1,
    presentationStartMs: 0,
    presentationEndMs: 150 * MINUTE_MS,
    presentationBreaks: [],
    minGapMinutes: 30,
    suggestBreaks: false,
    suggestResources: false,
  };
}

function buildSchedule(withExtraPresentationSlot: boolean): Schedule {
  const slots = [
    {
      id: "PRESENTATION-1",
      track: Track.PRESENTATION,
      startMs: 0,
      endMs: 30 * MINUTE_MS,
      resources: { roomIds: [1] },
    },
    {
      id: "PRESENTATION-2",
      track: Track.PRESENTATION,
      startMs: 60 * MINUTE_MS,
      endMs: 90 * MINUTE_MS,
      resources: { roomIds: [1] },
    },
    ...(withExtraPresentationSlot
      ? [
          {
            id: "PRESENTATION-3",
            track: Track.PRESENTATION,
            startMs: 120 * MINUTE_MS,
            endMs: 150 * MINUTE_MS,
            resources: { roomIds: [1] },
          },
        ]
      : []),
    {
      id: "ROBOT-1",
      track: Track.ROBOT,
      startMs: 60 * MINUTE_MS,
      endMs: 90 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    {
      id: "ROBOT-2",
      track: Track.ROBOT,
      startMs: 120 * MINUTE_MS,
      endMs: 150 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
  ];

  const assignments: Assignment[] = [
    {
      id: "presentation-team-1",
      teamId: 1,
      type: AssignmentType.PRESENTATION,
      slotId: "PRESENTATION-2",
      resourceId: "1",
      sequence: null,
    },
    {
      id: "presentation-team-2",
      teamId: 2,
      type: AssignmentType.PRESENTATION,
      slotId: "PRESENTATION-1",
      resourceId: "1",
      sequence: null,
    },
    {
      id: "robot-team-1",
      teamId: 1,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-2",
      resourceId: "1",
      sequence: 1,
    },
    {
      id: "robot-team-2",
      teamId: 2,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-1",
      resourceId: "1",
      sequence: 1,
    },
  ];

  return { slots, assignments };
}

function buildRobotSetup(teamCount = 2): TournamentSetup {
  return {
    teams: Array.from({ length: teamCount }, (_, index) => ({ id: index + 1 })),
    robotTablesCount: 1,
    robotStartMs: 0,
    robotEndMs: 30 * MINUTE_MS,
    robotBreaks: [],
    presentationRoomsCount: 1,
    presentationStartMs: 0,
    presentationEndMs: 30 * MINUTE_MS,
    presentationBreaks: [],
    minGapMinutes: 5,
    suggestBreaks: false,
    suggestResources: false,
  };
}

function buildRobotSchedule(withExtraSlot: boolean, includeThirdTeam = false): Schedule {
  const slots = [
    {
      id: "ROBOT-0",
      track: Track.ROBOT,
      startMs: 0,
      endMs: 5 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    {
      id: "ROBOT-5",
      track: Track.ROBOT,
      startMs: 5 * MINUTE_MS,
      endMs: 10 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    {
      id: "ROBOT-10",
      track: Track.ROBOT,
      startMs: 10 * MINUTE_MS,
      endMs: 15 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    {
      id: "ROBOT-15",
      track: Track.ROBOT,
      startMs: 15 * MINUTE_MS,
      endMs: 20 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    {
      id: "ROBOT-20",
      track: Track.ROBOT,
      startMs: 20 * MINUTE_MS,
      endMs: 25 * MINUTE_MS,
      resources: { tableIds: [1] },
    },
    ...(withExtraSlot
      ? [
          {
            id: "ROBOT-25",
            track: Track.ROBOT,
            startMs: 25 * MINUTE_MS,
            endMs: 30 * MINUTE_MS,
            resources: { tableIds: [1] },
          },
        ]
      : []),
  ];

  const assignments: Assignment[] = [
    {
      id: "robot-team-1-seq-1",
      teamId: 1,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-10",
      resourceId: "1",
      sequence: 1,
    },
    {
      id: "robot-team-1-seq-2",
      teamId: 1,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-20",
      resourceId: "1",
      sequence: 2,
    },
    {
      id: "robot-team-2-seq-1",
      teamId: 2,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-0",
      resourceId: "1",
      sequence: 1,
    },
    {
      id: "robot-team-2-seq-2",
      teamId: 2,
      type: AssignmentType.ROBOT_MATCH,
      slotId: "ROBOT-15",
      resourceId: "1",
      sequence: 2,
    },
    ...(includeThirdTeam
      ? [
          {
            id: "robot-team-3-seq-1",
            teamId: 3,
            type: AssignmentType.ROBOT_MATCH,
            slotId: "ROBOT-5",
            resourceId: "1",
            sequence: 1,
          },
        ]
      : []),
  ];

  return { slots, assignments };
}

describe("autoReshuffle", () => {
  it("repairs a presentation move by moving one other presentation", () => {
    const setup = buildSetup();
    const schedule = buildSchedule(true);

    const result = autoReshuffle(schedule, setup, {
      type: "presentation",
      active: {
        type: "presentation",
        slotId: "PRESENTATION-2",
        resourceId: 1,
        teamId: 1,
      },
      over: {
        type: "presentation",
        slotId: "PRESENTATION-1",
        resourceId: 1,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const team1Presentation = result.schedule.assignments.find(
      (assignment) =>
        assignment.type === AssignmentType.PRESENTATION &&
        assignment.teamId === 1
    );
    const team2Presentation = result.schedule.assignments.find(
      (assignment) =>
        assignment.type === AssignmentType.PRESENTATION &&
        assignment.teamId === 2
    );

    expect(team1Presentation?.slotId).toBe("PRESENTATION-1");
    expect(team2Presentation?.slotId).toBe("PRESENTATION-3");
  });

  it("fails when it cannot repair the presentation move", () => {
    const setup = buildSetup();
    const schedule = buildSchedule(false);

    const result = autoReshuffle(schedule, setup, {
      type: "presentation",
      active: {
        type: "presentation",
        slotId: "PRESENTATION-2",
        resourceId: 1,
        teamId: 1,
      },
      over: {
        type: "presentation",
        slotId: "PRESENTATION-1",
        resourceId: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.code).toBe("UNRESOLVABLE");
  });

  it("repairs a robot move by moving one other robot match", () => {
    const setup = buildRobotSetup();
    const schedule = buildRobotSchedule(true);

    const result = autoReshuffle(schedule, setup, {
      type: "robot",
      active: {
        type: "robot",
        slotId: "ROBOT-10",
        tableId: 1,
        teamId: 1,
      },
      over: {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const team1Seq1 = result.schedule.assignments.find(
      (assignment) =>
        assignment.type === AssignmentType.ROBOT_MATCH &&
        assignment.teamId === 1 &&
        assignment.sequence === 1
    );
    expect(team1Seq1?.slotId).toBe("ROBOT-0");
    const movedAssignments = applyRobotMove(
      schedule.assignments,
      {
        type: "robot",
        slotId: "ROBOT-10",
        tableId: 1,
        teamId: 1,
      },
      { type: "robot", slotId: "ROBOT-0", tableId: 1 },
      schedule.slots
    );
    const changedAssignments = result.schedule.assignments.filter(
      (assignment) => {
        const previous = movedAssignments.find(
          (candidate) => candidate.id === assignment.id
        );
        if (!previous) return false;
        return (
          previous.slotId !== assignment.slotId ||
          previous.resourceId !== assignment.resourceId
        );
      }
    );

    expect(changedAssignments.length).toBeGreaterThan(0);
    expect(
      validateSchedule(setup, result.schedule.slots, result.schedule.assignments)
    ).toHaveLength(0);
  });

  it("fails when a robot move cannot be repaired", () => {
    const setup = buildRobotSetup(3);
    const schedule = buildRobotSchedule(false, true);

    const result = autoReshuffle(schedule, setup, {
      type: "robot",
      active: {
        type: "robot",
        slotId: "ROBOT-10",
        tableId: 1,
        teamId: 1,
      },
      over: {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason.code).toBe("UNRESOLVABLE");
  });

  it("does not commit a schedule that violates robot sequencing order", () => {
    const setup = buildRobotSetup();
    const schedule: Schedule = {
      slots: [
        {
          id: "ROBOT-0",
          track: Track.ROBOT,
          startMs: 0,
          endMs: 5 * MINUTE_MS,
          resources: { tableIds: [1] },
        },
        {
          id: "ROBOT-5",
          track: Track.ROBOT,
          startMs: 5 * MINUTE_MS,
          endMs: 10 * MINUTE_MS,
          resources: { tableIds: [1] },
        },
        {
          id: "ROBOT-10",
          track: Track.ROBOT,
          startMs: 10 * MINUTE_MS,
          endMs: 15 * MINUTE_MS,
          resources: { tableIds: [1] },
        },
        {
          id: "ROBOT-15",
          track: Track.ROBOT,
          startMs: 15 * MINUTE_MS,
          endMs: 20 * MINUTE_MS,
          resources: { tableIds: [1] },
        },
      ],
      assignments: [
        {
          id: "robot-team-1-seq-1",
          teamId: 1,
          type: AssignmentType.ROBOT_MATCH,
          slotId: "ROBOT-0",
          resourceId: "1",
          sequence: 1,
        },
        {
          id: "robot-team-2-seq-1",
          teamId: 2,
          type: AssignmentType.ROBOT_MATCH,
          slotId: "ROBOT-5",
          resourceId: "1",
          sequence: 1,
        },
        {
          id: "robot-team-1-seq-2",
          teamId: 1,
          type: AssignmentType.ROBOT_MATCH,
          slotId: "ROBOT-10",
          resourceId: "1",
          sequence: 2,
        },
        {
          id: "robot-team-2-seq-2",
          teamId: 2,
          type: AssignmentType.ROBOT_MATCH,
          slotId: "ROBOT-15",
          resourceId: "1",
          sequence: 2,
        },
      ],
    };

    const result = autoReshuffle(schedule, setup, {
      type: "robot",
      active: {
        type: "robot",
        slotId: "ROBOT-0",
        tableId: 1,
        teamId: 1,
      },
      over: {
        type: "robot",
        slotId: "ROBOT-15",
        tableId: 1,
      },
    });

    expect(result.ok).toBe(false);
  });
});
