import { describe, expect, it } from "vitest";
import { robotSlots } from "../slots/robotSlots";

const MINUTE_MS = 60_000;

describe("robotSlots", () => {
  it("alternates table groups for multiple table counts", () => {
    const cases = [
      {
        tables: 1,
        expected: [[1], [1]],
      },
      {
        tables: 2,
        expected: [[1], [2], [1], [2]],
      },
      {
        tables: 3,
        expected: [
          [1, 3],
          [2],
          [1, 3],
          [2],
        ],
      },
      {
        tables: 4,
        expected: [
          [1, 3],
          [2, 4],
          [1, 3],
          [2, 4],
        ],
      },
      {
        tables: 6,
        expected: [
          [1, 3, 5],
          [2, 4, 6],
          [1, 3, 5],
          [2, 4, 6],
        ],
      },
    ];

    for (const { tables, expected } of cases) {
      const slots = robotSlots({
        robotStartMs: 0,
        robotEndMs: 20 * MINUTE_MS,
        robotTablesCount: tables,
        robotBreaks: [],
      });

      expect(slots.map((slot) => slot.resources.tableIds)).toEqual(expected);
    }
  });

  it("excludes slots that would intersect breaks", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 30 * MINUTE_MS,
      robotTablesCount: 2,
      robotBreaks: [{ startMs: 5 * MINUTE_MS, endMs: 15 * MINUTE_MS }],
    });

    expect(slots.map((slot) => slot.startMs)).toEqual([
      0,
      15 * MINUTE_MS,
      20 * MINUTE_MS,
      25 * MINUTE_MS,
    ]);
  });

  it("reflects capacity based on table IDs per slot", () => {
    const slots = robotSlots({
      robotStartMs: 0,
      robotEndMs: 20 * MINUTE_MS,
      robotTablesCount: 3,
      robotBreaks: [],
    });

    const capacity = slots.reduce(
      (sum, slot) => sum + (slot.resources.tableIds?.length ?? 0),
      0,
    );

    expect(capacity).toBe(6);
    expect(slots.every((slot) => slot.resources.tableIds?.length)).toBe(true);
  });
});
