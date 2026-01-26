import type { GenerateScheduleResult, TournamentSetup } from "../domain";

export function generateSchedule(_setup: TournamentSetup): GenerateScheduleResult {
  return {
    ok: true,
    schedule: {
      slots: [],
      assignments: [],
      warnings: [],
    },
  };
}
