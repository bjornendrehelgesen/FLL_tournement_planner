import type { DomainError, TimeWindow, TournamentSetup, ValidateSetupResult } from "../domain";
import { isValidWindow, overlaps, withinWindow } from "../domain";

function buildInputError(
  code: DomainError["code"],
  message: string,
  path?: string,
  meta?: Record<string, unknown>
): DomainError {
  return {
    code,
    message,
    path,
    kind: "INPUT",
    meta,
  };
}

function validateBreaks(
  breaks: TimeWindow[],
  window: TimeWindow,
  pathPrefix: string,
  errors: DomainError[]
) {
  breaks.forEach((breakWindow, index) => {
    const path = `${pathPrefix}[${index}]`;
    if (!isValidWindow(breakWindow)) {
      errors.push(
        buildInputError(
          "BREAK_START_AFTER_END",
          "Break start must be before its end.",
          path
        )
      );
    }

    if (!withinWindow(breakWindow, window)) {
      errors.push(
        buildInputError(
          "BREAK_OUTSIDE_WINDOW",
          "Break must fall within the track window.",
          path
        )
      );
    }
  });

  const sorted = breaks
    .map((breakWindow, index) => ({ breakWindow, index }))
    .sort((a, b) => a.breakWindow.startMs - b.breakWindow.startMs);

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (overlaps(previous.breakWindow, current.breakWindow)) {
      errors.push(
        buildInputError(
          "BREAK_OVERLAP",
          "Breaks may not overlap within the same track.",
          `${pathPrefix}[${current.index}]`,
          { otherIndex: previous.index }
        )
      );
    }
  }
}

export function validateSetup(setup: TournamentSetup): ValidateSetupResult {
  const errors: DomainError[] = [];

  if (setup.teams.length <= 1) {
    errors.push(
      buildInputError(
        "TEAMS_TOO_FEW",
        "At least two teams are required.",
        "teams"
      )
    );
  }

  if (setup.robotTablesCount < 1) {
    errors.push(
      buildInputError(
        "ROBOT_TABLES_TOO_FEW",
        "At least one robot table is required.",
        "robotTablesCount"
      )
    );
  }

  if (setup.presentationRoomsCount < 1) {
    errors.push(
      buildInputError(
        "PRESENTATION_ROOMS_TOO_FEW",
        "At least one presentation room is required.",
        "presentationRoomsCount"
      )
    );
  }

  const robotWindow = { startMs: setup.robotStartMs, endMs: setup.robotEndMs };
  if (!isValidWindow(robotWindow)) {
    errors.push(
      buildInputError(
        "ROBOT_WINDOW_INVALID",
        "Robot window start must be before its end.",
        "robotWindow"
      )
    );
  }

  const presentationWindow = {
    startMs: setup.presentationStartMs,
    endMs: setup.presentationEndMs,
  };
  if (!isValidWindow(presentationWindow)) {
    errors.push(
      buildInputError(
        "PRESENTATION_WINDOW_INVALID",
        "Presentation window start must be before its end.",
        "presentationWindow"
      )
    );
  }

  if (setup.minGapMinutes < 15) {
    errors.push(
      buildInputError(
        "MIN_GAP_TOO_SMALL",
        "Minimum gap must be at least 15 minutes.",
        "minGapMinutes"
      )
    );
  }

  validateBreaks(setup.robotBreaks, robotWindow, "robotBreaks", errors);
  validateBreaks(
    setup.presentationBreaks,
    presentationWindow,
    "presentationBreaks",
    errors
  );

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
