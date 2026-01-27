export type InputErrorCode =
  | "TEAMS_TOO_FEW"
  | "ROBOT_TABLES_TOO_FEW"
  | "PRESENTATION_ROOMS_TOO_FEW"
  | "ROBOT_WINDOW_INVALID"
  | "PRESENTATION_WINDOW_INVALID"
  | "BREAK_START_AFTER_END"
  | "BREAK_OUTSIDE_WINDOW"
  | "BREAK_OVERLAP"
  | "MIN_GAP_TOO_SMALL";

export type FeasibilityErrorCode =
  | "INSUFFICIENT_ROBOT_CAPACITY"
  | "INSUFFICIENT_PRESENTATION_CAPACITY"
  | "NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS"
  | "UNSATISFIABLE_OVERLAP_CONSTRAINTS";

export type DomainErrorCode = InputErrorCode | FeasibilityErrorCode;

export type DomainError = {
  code: DomainErrorCode;
  message: string;
  path?: string;
  kind: "INPUT" | "FEASIBILITY";
  meta?: Record<string, unknown>;
};
