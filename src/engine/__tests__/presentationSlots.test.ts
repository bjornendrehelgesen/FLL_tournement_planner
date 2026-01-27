import { describe, expect, it } from "vitest";
import { presentationSlots } from "../slots/presentationSlots";

const MINUTE_MS = 60_000;

describe("presentationSlots", () => {
  it("generates correct count with no breaks", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 2 * 60 * MINUTE_MS,
      presentationRoomsCount: 2,
      presentationBreaks: [],
    });

    expect(slots).toHaveLength(4);
  });

  it("excludes slots that would intersect breaks", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 2 * 60 * MINUTE_MS,
      presentationRoomsCount: 2,
      presentationBreaks: [{ startMs: 15 * MINUTE_MS, endMs: 45 * MINUTE_MS }],
    });

    expect(slots.map((slot) => slot.startMs)).toEqual([
      60 * MINUTE_MS,
      90 * MINUTE_MS,
    ]);
  });

  it("includes room IDs for every slot", () => {
    const slots = presentationSlots({
      presentationStartMs: 0,
      presentationEndMs: 60 * MINUTE_MS,
      presentationRoomsCount: 3,
      presentationBreaks: [],
    });

    expect(slots.every((slot) => slot.resources.roomIds)).toBe(true);
    expect(
      slots.every((slot) => slot.resources.roomIds?.join(",") === "1,2,3"),
    ).toBe(true);
  });

  it("keeps all slots within the presentation window", () => {
    const slots = presentationSlots({
      presentationStartMs: 10 * MINUTE_MS,
      presentationEndMs: 100 * MINUTE_MS,
      presentationRoomsCount: 1,
      presentationBreaks: [],
    });

    expect(
      slots.every(
        (slot) =>
          slot.startMs >= 10 * MINUTE_MS && slot.endMs <= 100 * MINUTE_MS,
      ),
    ).toBe(true);
  });
});
