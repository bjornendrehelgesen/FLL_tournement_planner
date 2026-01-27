import { describe, expect, it } from "vitest";
import { assignPresentations } from "../assign/presentations";
import { presentationSlots } from "../slots/presentationSlots";
import type { Team } from "../../domain";

const MINUTE_MS = 60_000;

function buildTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
  }));
}

describe("assignPresentations", () => {
  it("assigns every team when capacity matches exactly", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 60 * MINUTE_MS,
      presentationRoomsCount: 2,
      presentationBreaks: [],
    });
    const teams = buildTeams(4);

    const assignments = assignPresentations({ teams, slots });

    expect(assignments).toHaveLength(4);
    expect(assignments.map((assignment) => assignment.teamId)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("fills slots room-by-room in order", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 60 * MINUTE_MS,
      presentationRoomsCount: 2,
      presentationBreaks: [],
    });
    const teams = buildTeams(4);

    const assignments = assignPresentations({ teams, slots });

    expect(assignments).toEqual([
      expect.objectContaining({
        teamId: 1,
        slotId: slots[0].id,
        resourceId: "1",
      }),
      expect.objectContaining({
        teamId: 2,
        slotId: slots[0].id,
        resourceId: "2",
      }),
      expect.objectContaining({
        teamId: 3,
        slotId: slots[1].id,
        resourceId: "1",
      }),
      expect.objectContaining({
        teamId: 4,
        slotId: slots[1].id,
        resourceId: "2",
      }),
    ]);
  });

  it("returns deterministic output", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 60 * MINUTE_MS,
      presentationRoomsCount: 2,
      presentationBreaks: [],
    });
    const teams = buildTeams(4);

    const first = assignPresentations({ teams, slots });
    const second = assignPresentations({ teams, slots });

    expect(first).toEqual(second);
  });
});
