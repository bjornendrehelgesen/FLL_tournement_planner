import { describe, expect, it } from "vitest";
import { validateSetup } from "../validateSetup";
import type { TournamentSetup } from "../../domain";

describe("validateSetup", () => {
  it("returns ok: true for the stub", () => {
    const setup: TournamentSetup = {
      teams: [{ id: 1, name: "Team 1" }],
      robotTablesCount: 2,
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
    };

    expect(validateSetup(setup)).toEqual({ ok: true });
  });
});
