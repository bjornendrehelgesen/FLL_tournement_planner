import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { validateSchedule } from "../validateSchedule";
import { AssignmentType, type TournamentSetup } from "../../domain";

const MINUTE_MS = 60_000;

function buildSetup(overrides: Partial<TournamentSetup>): TournamentSetup {
  return {
    teams: [
      { id: 1, name: "Team 1" },
      { id: 2, name: "Team 2" },
    ],
    robotTablesCount: 2,
    robotStartMs: 30 * MINUTE_MS,
    robotEndMs: 120 * MINUTE_MS,
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

describe("generateSchedule gap constraints", () => {
  it("skips early slots to satisfy min gap and produces a conflict-free schedule", () => {
    const setup = buildSetup({});
    const result = generateSchedule(setup);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const conflicts = validateSchedule(
      setup,
      result.schedule.slots,
      result.schedule.assignments,
    );
    expect(conflicts).toHaveLength(0);

    const robotAssignments = result.schedule.assignments.filter(
      (assignment) => assignment.type === AssignmentType.ROBOT_MATCH,
    );
    const slotById = new Map(
      result.schedule.slots.map((slot) => [slot.id, slot]),
    );
    const earliestRobotStart = Math.min(
      ...robotAssignments.map(
        (assignment) => slotById.get(assignment.slotId)?.startMs ?? Infinity,
      ),
    );
    expect(earliestRobotStart).toBeGreaterThanOrEqual(45 * MINUTE_MS);
  });

  it("returns a gap constraint failure when matches cannot be spaced out", () => {
    const setup = buildSetup({
      minGapMinutes: 30,
      robotEndMs: 90 * MINUTE_MS,
    });

    const result = generateSchedule(setup);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0]?.code).toBe(
      "NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS",
    );
  });
});
