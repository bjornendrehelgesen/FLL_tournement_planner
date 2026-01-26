import { describe, expect, it } from "vitest";
import { validateSetup } from "../validateSetup";
import type { TournamentSetup } from "../../domain";

describe("validateSetup", () => {
  it("returns ok: true for the stub", () => {
    const setup: TournamentSetup = {
      teams: [{ id: "T1", name: "Team 1" }],
      tracks: ["table-1"],
      startMs: 0,
      slotDurationMs: 10 * 60 * 1000,
    };

    expect(validateSetup(setup)).toEqual({ ok: true });
  });
});
