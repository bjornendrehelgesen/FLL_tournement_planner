import { addMinutes, overlaps } from "../../domain";
import type { EpochMs, Slot, TimeWindow } from "../../domain";
import { Track } from "../../domain";

const SLOT_MINUTES = 5;

interface RobotSlotsInput {
  robotStartMs: EpochMs;
  robotEndMs: EpochMs;
  robotTablesCount: number;
  robotBreaks: TimeWindow[];
}

function buildTableGroups(tablesCount: number): {
  groupA: number[];
  groupB: number[];
} {
  const groupA: number[] = [];
  const groupB: number[] = [];

  for (let tableId = 1; tableId <= tablesCount; tableId += 1) {
    if (tableId % 2 === 1) {
      groupA.push(tableId);
    } else {
      groupB.push(tableId);
    }
  }

  return { groupA, groupB };
}

function buildSlotId(startMs: EpochMs): string {
  return `${Track.ROBOT}-${startMs}`;
}

export function robotSlots({
  robotStartMs,
  robotEndMs,
  robotTablesCount,
  robotBreaks,
}: RobotSlotsInput): Slot[] {
  const slots: Slot[] = [];
  const { groupA, groupB } = buildTableGroups(robotTablesCount);
  let slotIndex = 1;

  for (
    let startMs = robotStartMs;
    startMs + SLOT_MINUTES * 60_000 <= robotEndMs;
    startMs = addMinutes(startMs, SLOT_MINUTES)
  ) {
    const endMs = addMinutes(startMs, SLOT_MINUTES);
    const slotWindow = { startMs, endMs };
    const intersectsBreak = robotBreaks.some((breakWindow) =>
      overlaps(slotWindow, breakWindow),
    );
    const activeTables = slotIndex % 2 === 1 ? groupA : groupB;

    slotIndex += 1;

    if (intersectsBreak) {
      continue;
    }

    // Skip empty table groups (e.g. even slots when only one table exists).
    if (activeTables.length === 0) {
      continue;
    }

    slots.push({
      id: buildSlotId(startMs),
      track: Track.ROBOT,
      startMs,
      endMs,
      resources: {
        tableIds: [...activeTables],
      },
    });
  }

  return slots;
}
