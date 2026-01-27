import { addMinutes, overlaps } from "../../domain";
import type { EpochMs, Slot, TimeWindow } from "../../domain";
import { Track } from "../../domain";

const SLOT_MINUTES = 30;

interface PresentationSlotsInput {
  presentationStartMs: EpochMs;
  presentationEndMs: EpochMs;
  presentationRoomsCount: number;
  presentationBreaks: TimeWindow[];
}

function buildRoomIds(roomsCount: number): number[] {
  return Array.from({ length: roomsCount }, (_, index) => index + 1);
}

function buildSlotId(startMs: EpochMs): string {
  return `${Track.PRESENTATION}-${startMs}`;
}

export function presentationSlots({
  presentationStartMs,
  presentationEndMs,
  presentationRoomsCount,
  presentationBreaks,
}: PresentationSlotsInput): Slot[] {
  const slots: Slot[] = [];
  const roomIds = buildRoomIds(presentationRoomsCount);

  for (
    let startMs = presentationStartMs;
    startMs + SLOT_MINUTES * 60_000 <= presentationEndMs;
    startMs = addMinutes(startMs, SLOT_MINUTES)
  ) {
    const endMs = addMinutes(startMs, SLOT_MINUTES);
    const slotWindow = { startMs, endMs };
    const intersectsBreak = presentationBreaks.some((breakWindow) =>
      overlaps(slotWindow, breakWindow),
    );

    if (intersectsBreak) {
      continue;
    }

    slots.push({
      id: buildSlotId(startMs),
      track: Track.PRESENTATION,
      startMs,
      endMs,
      resources: {
        roomIds: [...roomIds],
      },
    });
  }

  return slots;
}
