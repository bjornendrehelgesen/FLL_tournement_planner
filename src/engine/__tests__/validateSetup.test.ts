import { describe, expect, it } from "vitest";
import { validateSetup } from "../validateSetup";
import type { DomainErrorCode, TournamentSetup } from "../../domain";

describe("validateSetup", () => {
  const buildSetup = (): TournamentSetup => ({
    teams: [{ id: 1, name: "Team 1" }, { id: 2, name: "Team 2" }],
    robotTablesCount: 1,
    robotStartMs: 0,
    robotEndMs: 60 * 60 * 1000,
    robotBreaks: [],
    presentationRoomsCount: 1,
    presentationStartMs: 0,
    presentationEndMs: 60 * 60 * 1000,
    presentationBreaks: [],
    minGapMinutes: 15,
    suggestBreaks: false,
    suggestResources: false,
  });

  const errorCodes = (setup: TournamentSetup): DomainErrorCode[] => {
    const result = validateSetup(setup);
    return result.ok ? [] : result.errors.map((error) => error.code);
  };

  it("returns ok: true for a valid setup", () => {
    const setup = buildSetup();

    expect(validateSetup(setup)).toEqual({ ok: true });
  });

  it("flags too few teams", () => {
    const setup = buildSetup();
    setup.teams = [{ id: 1 }];

    expect(errorCodes(setup)).toEqual(["TEAMS_TOO_FEW"]);
  });

  it("flags missing robot tables", () => {
    const setup = buildSetup();
    setup.robotTablesCount = 0;

    expect(errorCodes(setup)).toEqual(["ROBOT_TABLES_TOO_FEW"]);
  });

  it("flags missing presentation rooms", () => {
    const setup = buildSetup();
    setup.presentationRoomsCount = 0;

    expect(errorCodes(setup)).toEqual(["PRESENTATION_ROOMS_TOO_FEW"]);
  });

  it("flags an invalid robot window", () => {
    const setup = buildSetup();
    setup.robotStartMs = 1000;
    setup.robotEndMs = 500;

    expect(errorCodes(setup)).toEqual(["ROBOT_WINDOW_INVALID"]);
  });

  it("flags an invalid presentation window", () => {
    const setup = buildSetup();
    setup.presentationStartMs = 2000;
    setup.presentationEndMs = 1500;

    expect(errorCodes(setup)).toEqual(["PRESENTATION_WINDOW_INVALID"]);
  });

  it("flags a min gap below 15 minutes", () => {
    const setup = buildSetup();
    setup.minGapMinutes = 10;

    expect(errorCodes(setup)).toEqual(["MIN_GAP_TOO_SMALL"]);
  });

  it("flags breaks that start after they end", () => {
    const setup = buildSetup();
    setup.robotBreaks = [{ startMs: 3000, endMs: 2000 }];

    expect(errorCodes(setup)).toEqual(["BREAK_START_AFTER_END"]);
  });

  it("flags breaks outside their window", () => {
    const setup = buildSetup();
    setup.robotBreaks = [{ startMs: -1000, endMs: 1000 }];

    expect(errorCodes(setup)).toEqual(["BREAK_OUTSIDE_WINDOW"]);
  });

  it("flags overlapping breaks", () => {
    const setup = buildSetup();
    setup.robotBreaks = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 1500, endMs: 2500 },
    ];

    expect(errorCodes(setup)).toEqual(["BREAK_OVERLAP"]);
  });
});
