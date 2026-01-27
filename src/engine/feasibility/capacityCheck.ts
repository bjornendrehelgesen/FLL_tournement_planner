import type {
  CapacityCheckResult,
  DomainError,
  SuggestionAction,
  TournamentSetup,
} from "../../domain";
import { presentationSlots } from "../slots/presentationSlots";
import { robotSlots } from "../slots/robotSlots";

const ROBOT_MATCHES_PER_TEAM = 3;
const PRESENTATIONS_PER_TEAM = 1;
const MIN_GAP_FLOOR_MINUTES = 15;

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
    suggestions.push({ action: "INCREASE_ROBOT_TABLES" });
    suggestions.push({ action: "EXTEND_ROBOT_END_TIME" });
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
    suggestions.push({ action: "INCREASE_PRESENTATION_ROOMS" });
    suggestions.push({ action: "EXTEND_PRESENTATION_END_TIME" });
  }

  if (errors.length === 0) {
    return { ok: true };
  }

  if (setup.minGapMinutes > MIN_GAP_FLOOR_MINUTES) {
    suggestions.push({
      action: "REDUCE_MIN_GAP",
      minutes: MIN_GAP_FLOOR_MINUTES,
    });
  }

  return { ok: false, errors, suggestions };
}
