import type { TournamentSetup, ValidateSetupResult } from "../domain";

export function validateSetup(_setup: TournamentSetup): ValidateSetupResult {
  return { ok: true };
}
