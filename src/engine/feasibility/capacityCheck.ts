import type {
  CapacityCheckResult,
  DomainError,
  SuggestionAction,
  TournamentSetup,
} from "../../domain";
import { addMinutes, overlaps } from "../../domain";
import { presentationSlots } from "../slots/presentationSlots";
import { robotSlots } from "../slots/robotSlots";

const ROBOT_MATCHES_PER_TEAM = 3;
const PRESENTATIONS_PER_TEAM = 1;
const MIN_GAP_FLOOR_MINUTES = 15;
const ROBOT_SLOT_MINUTES = 5;
const PRESENTATION_SLOT_MINUTES = 30;

function buildFeasibilityError(
  code: DomainError["code"],
  message: string,
  path?: string,
  meta?: Record<string, unknown>,
): DomainError {
  return {
    code,
    message,
    path,
    kind: "FEASIBILITY",
    meta,
  };
}

function countRobotIntervals(setup: TournamentSetup): {
  oddCount: number;
  evenCount: number;
} {
  let oddCount = 0;
  let evenCount = 0;
  let slotIndex = 1;
  const slotDurationMs = ROBOT_SLOT_MINUTES * 60_000;

  for (
    let startMs = setup.robotStartMs;
    startMs + slotDurationMs <= setup.robotEndMs;
    startMs = addMinutes(startMs, ROBOT_SLOT_MINUTES)
  ) {
    const endMs = addMinutes(startMs, ROBOT_SLOT_MINUTES);
    const slotWindow = { startMs, endMs };
    const intersectsBreak = setup.robotBreaks.some((breakWindow) =>
      overlaps(slotWindow, breakWindow),
    );
    const isOdd = slotIndex % 2 === 1;
    slotIndex += 1;

    if (intersectsBreak) {
      continue;
    }

    if (isOdd) {
      oddCount += 1;
    } else {
      evenCount += 1;
    }
  }

  return { oddCount, evenCount };
}

function minRobotTablesForCapacity(
  required: number,
  oddCount: number,
  evenCount: number,
): number | null {
  const total = oddCount + evenCount;
  if (total === 0) return null;

  const minEvenK = Math.ceil(required / total);
  const minEvenTables = Math.max(2 * minEvenK, 2);

  let minOddTables = 1;
  if (required > oddCount) {
    const minOddK = Math.ceil((required - oddCount) / total);
    minOddTables = 2 * minOddK + 1;
  }

  return Math.min(minEvenTables, minOddTables);
}

function minPresentationRoomsForCapacity(
  required: number,
  slotCount: number,
): number | null {
  if (slotCount <= 0) return null;
  return Math.ceil(required / slotCount);
}

function requiredRobotExtensionMinutes(
  setup: TournamentSetup,
  required: number,
  currentCapacity: number,
): number | null {
  if (currentCapacity >= required) return 0;
  const tablesCount = setup.robotTablesCount;
  if (tablesCount <= 0) return null;

  const groupA = Math.ceil(tablesCount / 2);
  const groupB = Math.floor(tablesCount / 2);
  const slotDurationMs = ROBOT_SLOT_MINUTES * 60_000;
  let slotIndex =
    Math.floor((setup.robotEndMs - setup.robotStartMs) / slotDurationMs) + 1;
  let addedCapacity = 0;
  let minutesAdded = 0;
  let startMs = setup.robotEndMs;

  while (currentCapacity + addedCapacity < required) {
    const endMs = addMinutes(startMs, ROBOT_SLOT_MINUTES);
    const slotWindow = { startMs, endMs };
    const intersectsBreak = setup.robotBreaks.some((breakWindow) =>
      overlaps(slotWindow, breakWindow),
    );
    const activeTables = slotIndex % 2 === 1 ? groupA : groupB;
    slotIndex += 1;
    minutesAdded += ROBOT_SLOT_MINUTES;

    if (!intersectsBreak && activeTables > 0) {
      addedCapacity += activeTables;
    }

    startMs = endMs;
  }

  return minutesAdded;
}

function requiredPresentationExtensionMinutes(
  setup: TournamentSetup,
  required: number,
  currentCapacity: number,
): number | null {
  if (currentCapacity >= required) return 0;
  if (setup.presentationRoomsCount <= 0) return null;

  let addedCapacity = 0;
  let minutesAdded = 0;
  let startMs = setup.presentationEndMs;

  while (currentCapacity + addedCapacity < required) {
    const endMs = addMinutes(startMs, PRESENTATION_SLOT_MINUTES);
    const slotWindow = { startMs, endMs };
    const intersectsBreak = setup.presentationBreaks.some((breakWindow) =>
      overlaps(slotWindow, breakWindow),
    );
    minutesAdded += PRESENTATION_SLOT_MINUTES;
    if (!intersectsBreak) {
      addedCapacity += setup.presentationRoomsCount;
    }
    startMs = endMs;
  }

  return minutesAdded;
}

export function capacityCheck(setup: TournamentSetup): CapacityCheckResult {
  const teamCount = setup.teams.length;
  const robotNeed = teamCount * ROBOT_MATCHES_PER_TEAM;
  const presentationNeed = teamCount * PRESENTATIONS_PER_TEAM;

  const robotSlotsList = robotSlots({
    robotStartMs: setup.robotStartMs,
    robotEndMs: setup.robotEndMs,
    robotTablesCount: setup.robotTablesCount,
    robotBreaks: setup.robotBreaks,
  });
  const robotCapacity = robotSlotsList.reduce(
    (sum, slot) => sum + (slot.resources.tableIds?.length ?? 0),
    0,
  );

  const presentationSlotsCount = presentationSlots({
    presentationStartMs: setup.presentationStartMs,
    presentationEndMs: setup.presentationEndMs,
    presentationRoomsCount: setup.presentationRoomsCount,
    presentationBreaks: setup.presentationBreaks,
  }).length;
  const presentationCapacity =
    presentationSlotsCount * setup.presentationRoomsCount;

  const errors: DomainError[] = [];
  const suggestions: SuggestionAction[] = [];

  if (robotCapacity < robotNeed) {
    errors.push(
      buildFeasibilityError(
        "INSUFFICIENT_ROBOT_CAPACITY",
        "Not enough robot slots to cover every team.",
        "robotCapacity",
        { capacity: robotCapacity, required: robotNeed },
      ),
    );
    if (setup.suggestResources) {
      const { oddCount, evenCount } = countRobotIntervals(setup);
      const minTables = minRobotTablesForCapacity(
        robotNeed,
        oddCount,
        evenCount,
      );
      if (minTables !== null && minTables > setup.robotTablesCount) {
        suggestions.push({
          action: "INCREASE_ROBOT_TABLES",
          by: minTables - setup.robotTablesCount,
        });
      }

      const minutes = requiredRobotExtensionMinutes(
        setup,
        robotNeed,
        robotCapacity,
      );
      if (minutes !== null && minutes > 0) {
        suggestions.push({ action: "EXTEND_ROBOT_END_TIME", minutes });
      }
    }
  }

  if (presentationCapacity < presentationNeed) {
    errors.push(
      buildFeasibilityError(
        "INSUFFICIENT_PRESENTATION_CAPACITY",
        "Not enough presentation slots to cover every team.",
        "presentationCapacity",
        { capacity: presentationCapacity, required: presentationNeed },
      ),
    );
    if (setup.suggestResources) {
      const minRooms = minPresentationRoomsForCapacity(
        presentationNeed,
        presentationSlotsCount,
      );
      if (minRooms !== null && minRooms > setup.presentationRoomsCount) {
        suggestions.push({
          action: "INCREASE_PRESENTATION_ROOMS",
          by: minRooms - setup.presentationRoomsCount,
        });
      }
      const minutes = requiredPresentationExtensionMinutes(
        setup,
        presentationNeed,
        presentationCapacity,
      );
      if (minutes !== null && minutes > 0) {
        suggestions.push({ action: "EXTEND_PRESENTATION_END_TIME", minutes });
      }
    }
  }

  if (errors.length === 0) {
    return { ok: true };
  }

  if (
    setup.suggestResources &&
    setup.minGapMinutes > MIN_GAP_FLOOR_MINUTES
  ) {
    suggestions.push({
      action: "REDUCE_MIN_GAP",
      minutes: MIN_GAP_FLOOR_MINUTES,
    });
  }

  return { ok: false, errors, suggestions };
}
