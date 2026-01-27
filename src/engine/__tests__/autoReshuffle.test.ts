import { describe, expect, it } from "vitest";
import type { Assignment, Schedule, TournamentSetup } from "../../domain";
import { AssignmentType, Track } from "../../domain";
import { autoReshuffle } from "../autoReshuffle";

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
});
