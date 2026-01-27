import { describe, expect, it } from "vitest";
import { capacityCheck } from "../feasibility/capacityCheck";
import type { TournamentSetup } from "../../domain";

const MINUTE_MS = 60_000;

function buildSetup(overrides: Partial<TournamentSetup>): TournamentSetup {
  return {
    teams: [
      { id: 1, name: "Team 1" },
      { id: 2, name: "Team 2" },
    ],
    robotTablesCount: 2,
    robotStartMs: 0,
    robotEndMs: 30 * MINUTE_MS,
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

describe("capacityCheck", () => {
  it("treats exact capacity as sufficient", () => {
    const setup = buildSetup({
      teams: [
        { id: 1, name: "Team 1" },
        { id: 2, name: "Team 2" },
      ],
    });

    const result = capacityCheck(setup);

    expect(result.ok).toBe(true);
  });

  it("returns both insufficiency errors when needed", () => {
    const setup = buildSetup({
      teams: [
        { id: 1, name: "Team 1" },
        { id: 2, name: "Team 2" },
        { id: 3, name: "Team 3" },
      ],
      robotEndMs: 20 * MINUTE_MS,
      presentationEndMs: 30 * MINUTE_MS,
    });

    const result = capacityCheck(setup);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((error) => error.code);
      expect(codes).toContain("INSUFFICIENT_ROBOT_CAPACITY");
      expect(codes).toContain("INSUFFICIENT_PRESENTATION_CAPACITY");
    }
  });

  it("suggests sensible actions when capacity is insufficient", () => {
    const setup = buildSetup({
      teams: [
        { id: 1, name: "Team 1" },
        { id: 2, name: "Team 2" },
        { id: 3, name: "Team 3" },
      ],
      robotEndMs: 20 * MINUTE_MS,
      presentationEndMs: 30 * MINUTE_MS,
      minGapMinutes: 25,
    });

    const result = capacityCheck(setup);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: "INCREASE_ROBOT_TABLES" }),
          expect.objectContaining({ action: "EXTEND_ROBOT_END_TIME" }),
          expect.objectContaining({ action: "INCREASE_PRESENTATION_ROOMS" }),
          expect.objectContaining({ action: "EXTEND_PRESENTATION_END_TIME" }),
          expect.objectContaining({ action: "REDUCE_MIN_GAP", minutes: 15 }),
        ]),
      );
    }
  });
});
