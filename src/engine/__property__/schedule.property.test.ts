import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { generateSchedule } from "../generateSchedule";
import { validateSchedule } from "../validateSchedule";
import {
  AssignmentType,
  Track,
  addMinutes,
  type Assignment,
  type Slot,
  type TimeWindow,
  type TournamentSetup,
} from "../../domain";

type BreakPlan = { gapMinutes: number; lengthMinutes: number };

const MINUTE_MS = 60_000;
const RUNS = 100;
const KNOWN_ERROR_CODES = new Set([
  "TEAMS_TOO_FEW",
  "ROBOT_TABLES_TOO_FEW",
  "PRESENTATION_ROOMS_TOO_FEW",
  "ROBOT_WINDOW_INVALID",
  "PRESENTATION_WINDOW_INVALID",
  "BREAK_START_AFTER_END",
  "BREAK_OUTSIDE_WINDOW",
  "BREAK_OVERLAP",
  "MIN_GAP_TOO_SMALL",
  "INSUFFICIENT_ROBOT_CAPACITY",
  "INSUFFICIENT_PRESENTATION_CAPACITY",
  "NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS",
  "UNSATISFIABLE_OVERLAP_CONSTRAINTS",
]);

const breakPlanArb = fc.array(
  fc.record({
    gapMinutes: fc.integer({ min: 0, max: 30 }),
    lengthMinutes: fc.integer({ min: 5, max: 30 }),
  }),
  { maxLength: 4 },
);

function buildBreaks(
  startMs: number,
  endMs: number,
  plan: BreakPlan[],
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let cursor = startMs;

  for (const entry of plan) {
    const breakStart = addMinutes(cursor, entry.gapMinutes);
    const breakEnd = addMinutes(breakStart, entry.lengthMinutes);
    if (breakEnd > endMs) {
      break;
    }
    if (breakStart < breakEnd) {
      windows.push({ startMs: breakStart, endMs: breakEnd });
      cursor = breakEnd;
    }
  }

  return windows;
}

function durationArb(
  smallMin: number,
  smallMax: number,
  largeMin: number,
  largeMax: number,
) {
  return fc.oneof(
    fc.integer({ min: smallMin, max: smallMax }),
    fc.integer({ min: largeMin, max: largeMax }),
  );
}

const setupArb = fc
  .record({
    teamCount: fc.integer({ min: 2, max: 40 }),
    robotTablesCount: fc.integer({ min: 1, max: 6 }),
    presentationRoomsCount: fc.integer({ min: 1, max: 6 }),
    minGapMinutes: fc.integer({ min: 15, max: 45 }),
    robotStartOffsetMinutes: fc.integer({ min: 0, max: 60 }),
    presentationStartOffsetMinutes: fc.integer({ min: 0, max: 60 }),
    robotDurationMinutes: durationArb(20, 120, 180, 600),
    presentationDurationMinutes: durationArb(30, 150, 180, 600),
    robotBreakPlan: breakPlanArb,
    presentationBreakPlan: breakPlanArb,
    suggestBreaks: fc.boolean(),
    suggestResources: fc.boolean(),
  })
  .map((values): TournamentSetup => {
    const robotStartMs = values.robotStartOffsetMinutes * MINUTE_MS;
    const robotEndMs = addMinutes(robotStartMs, values.robotDurationMinutes);
    const presentationStartMs =
      values.presentationStartOffsetMinutes * MINUTE_MS;
    const presentationEndMs = addMinutes(
      presentationStartMs,
      values.presentationDurationMinutes,
    );

    return {
      teams: Array.from({ length: values.teamCount }, (_, index) => ({
        id: index + 1,
        name: `Team ${index + 1}`,
      })),
      robotTablesCount: values.robotTablesCount,
      robotStartMs,
      robotEndMs,
      robotBreaks: buildBreaks(robotStartMs, robotEndMs, values.robotBreakPlan),
      presentationRoomsCount: values.presentationRoomsCount,
      presentationStartMs,
      presentationEndMs,
      presentationBreaks: buildBreaks(
        presentationStartMs,
        presentationEndMs,
        values.presentationBreakPlan,
      ),
      minGapMinutes: values.minGapMinutes,
      suggestBreaks: values.suggestBreaks,
      suggestResources: values.suggestResources,
    };
  });

function expectAssignmentsMatchSlots(
  setup: TournamentSetup,
  slots: Slot[],
  assignments: Assignment[],
) {
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  for (const assignment of assignments) {
    const slot = slotById.get(assignment.slotId);
    expect(slot, `slot ${assignment.slotId} is missing`).toBeTruthy();
    if (!slot) continue;

    if (assignment.type === AssignmentType.ROBOT_MATCH) {
      expect(slot.track).toBe(Track.ROBOT);
      const tableIds = (slot.resources.tableIds ?? []).map(String);
      expect(tableIds).toContain(String(assignment.resourceId));
    } else {
      expect(slot.track).toBe(Track.PRESENTATION);
      const roomIds = (slot.resources.roomIds ?? []).map(String);
      expect(roomIds).toContain(String(assignment.resourceId));
    }
  }

  const presentationCount = assignments.filter(
    (assignment) => assignment.type === AssignmentType.PRESENTATION,
  ).length;
  const robotCount = assignments.filter(
    (assignment) => assignment.type === AssignmentType.ROBOT_MATCH,
  ).length;

  expect(presentationCount).toBe(setup.teams.length);
  expect(robotCount).toBe(setup.teams.length * 3);
}

describe("schedule property checks", () => {
  it(
    "produces valid schedules or structured failures",
    { timeout: 15_000 },
    () => {
      fc.assert(
        fc.property(setupArb, (setup) => {
          const result = generateSchedule(setup);

          if (result.ok) {
            const conflicts = validateSchedule(
              setup,
              result.schedule.slots,
              result.schedule.assignments,
            );
            expect(conflicts).toHaveLength(0);

            expectAssignmentsMatchSlots(
              setup,
              result.schedule.slots,
              result.schedule.assignments,
            );
          } else {
            expect(result.errors.length).toBeGreaterThan(0);
            for (const error of result.errors) {
              expect(KNOWN_ERROR_CODES.has(error.code)).toBe(true);
              expect(typeof error.message).toBe("string");
              expect(["INPUT", "FEASIBILITY"]).toContain(error.kind);
              if (error.path !== undefined) {
                expect(typeof error.path).toBe("string");
              }
              if (error.meta !== undefined) {
                expect(typeof error.meta).toBe("object");
              }
            }
          }
        }),
        { numRuns: RUNS },
      );
    },
  );
});
