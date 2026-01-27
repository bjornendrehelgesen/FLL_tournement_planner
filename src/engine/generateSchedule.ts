import type { GenerateScheduleResult, TournamentSetup } from "../domain";
import { assignRobotMatches } from "./assign/robots";
import { assignPresentations } from "./assign/presentations";
import { capacityCheck } from "./feasibility/capacityCheck";
import { presentationSlots } from "./slots/presentationSlots";
import { robotSlots } from "./slots/robotSlots";
import { validateSetup } from "./validateSetup";

export function generateSchedule(setup: TournamentSetup): GenerateScheduleResult {
  const validation = validateSetup(setup);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, suggestions: [] };
  }

  const capacityResult = capacityCheck(setup);
  if (!capacityResult.ok) {
    return {
      ok: false,
      errors: capacityResult.errors,
      suggestions: capacityResult.suggestions,
    };
  }

  const robotSlotsList = robotSlots({
    robotStartMs: setup.robotStartMs,
    robotEndMs: setup.robotEndMs,
    robotTablesCount: setup.robotTablesCount,
    robotBreaks: setup.robotBreaks,
  });
  const presentationSlotsList = presentationSlots({
    presentationStartMs: setup.presentationStartMs,
    presentationEndMs: setup.presentationEndMs,
    presentationRoomsCount: setup.presentationRoomsCount,
    presentationBreaks: setup.presentationBreaks,
  });

  const slots = [...robotSlotsList, ...presentationSlotsList].sort(
    (a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id),
  );
  const presentationAssignments = assignPresentations({
    teams: setup.teams,
    slots: presentationSlotsList,
  });
  const robotAssignments = assignRobotMatches({
    teams: setup.teams,
    slots: robotSlotsList,
  });
  const assignments = [...presentationAssignments, ...robotAssignments];

  return {
    ok: true,
    schedule: {
      slots,
      assignments,
      warnings: [],
    },
  };
}
