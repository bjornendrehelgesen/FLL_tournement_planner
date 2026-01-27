import { describe, expect, it } from "vitest";
import { assignRobotMatches } from "../assign/robots";
import { robotSlots } from "../slots/robotSlots";
import type { Assignment, Slot, Team } from "../../domain";

const MINUTE_MS = 60_000;

function buildTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
  }));
}

function buildSlotLookup(slots: Slot[]): Map<string, Slot> {
  return new Map(slots.map((slot) => [slot.id, slot]));
}

function expectSequenceOrdering(assignments: Assignment[], slots: Slot[]) {
  const slotById = buildSlotLookup(slots);

  const sequenceStats = (sequence: number) => {
    let maxEndMs = -Infinity;
    let minStartMs = Infinity;
    for (const assignment of assignments) {
      if (assignment.sequence !== sequence) continue;
      const slot = slotById.get(assignment.slotId);
      if (!slot) continue;
      if (slot.endMs > maxEndMs) {
        maxEndMs = slot.endMs;
      }
      if (slot.startMs < minStartMs) {
        minStartMs = slot.startMs;
      }
    }
    return { maxEndMs, minStartMs };
  };

  const seq1 = sequenceStats(1);
  const seq2 = sequenceStats(2);
  const seq3 = sequenceStats(3);

  expect(seq1.maxEndMs).toBeLessThanOrEqual(seq2.minStartMs);
  expect(seq2.maxEndMs).toBeLessThanOrEqual(seq3.minStartMs);
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
    expectSequenceOrdering(assignments, slots);
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

  it("allows sequence 2 to start when sequence 1 ends", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 20 * MINUTE_MS,
      robotTablesCount: 2,
      robotBreaks: [],
    });
    const teams = buildTeams(1);

    const assignments = assignRobotMatches({ teams, slots });
    const slotById = buildSlotLookup(slots);
    const seq1 = assignments.find((assignment) => assignment.sequence === 1);
    const seq2 = assignments.find((assignment) => assignment.sequence === 2);

    expect(seq1).toBeDefined();
    expect(seq2).toBeDefined();
    if (!seq1 || !seq2) return;

    const seq1Slot = slotById.get(seq1.slotId);
    const seq2Slot = slotById.get(seq2.slotId);
    expect(seq1Slot).toBeDefined();
    expect(seq2Slot).toBeDefined();
    if (!seq1Slot || !seq2Slot) return;

    expect(seq2Slot.startMs).toBe(seq1Slot.endMs);
  });
});
