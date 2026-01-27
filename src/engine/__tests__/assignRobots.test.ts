import { describe, expect, it } from "vitest";
import { assignRobotMatches } from "../assign/robots";
import { robotSlots } from "../slots/robotSlots";
import type { Team } from "../../domain";

const MINUTE_MS = 60_000;

function buildTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
  }));
}

describe("assignRobotMatches", () => {
  it("assigns exactly three robot matches per team", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 60 * MINUTE_MS,
      robotTablesCount: 4,
      robotBreaks: [],
    });
    const teams = buildTeams(4);

    const assignments = assignRobotMatches({ teams, slots });

    expect(assignments).toHaveLength(12);
    const counts = new Map<number, number>();
    for (const assignment of assignments) {
      counts.set(assignment.teamId, (counts.get(assignment.teamId) ?? 0) + 1);
    }
    expect(Array.from(counts.values())).toEqual([3, 3, 3, 3]);
  });

  it("avoids double-booking a robot table in a slot", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 60 * MINUTE_MS,
      robotTablesCount: 4,
      robotBreaks: [],
    });
    const teams = buildTeams(4);

    const assignments = assignRobotMatches({ teams, slots });

    const used = new Set<string>();
    for (const assignment of assignments) {
      const key = `${assignment.slotId}::${assignment.resourceId}`;
      expect(used.has(key)).toBe(false);
      used.add(key);
    }
  });

  it("uses only active tables for each slot", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 60 * MINUTE_MS,
      robotTablesCount: 4,
      robotBreaks: [],
    });
    const teams = buildTeams(4);

    const assignments = assignRobotMatches({ teams, slots });
    const slotById = new Map(slots.map((slot) => [slot.id, slot]));

    for (const assignment of assignments) {
      const slot = slotById.get(assignment.slotId);
      expect(slot).toBeDefined();
      expect(slot?.resources.tableIds).toContain(Number(assignment.resourceId));
    }
  });

  it("returns deterministic output", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 60 * MINUTE_MS,
      robotTablesCount: 4,
      robotBreaks: [],
    });
    const teams = buildTeams(4);

    const first = assignRobotMatches({ teams, slots });
    const second = assignRobotMatches({ teams, slots });

    expect(first).toEqual(second);
  });
});
