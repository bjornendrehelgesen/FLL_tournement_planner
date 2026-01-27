import type { DomainError } from "./errors";

// All times are stored as epoch milliseconds.
export type EpochMs = number;
export type TrackId = string;
export type SlotId = string;
export type TeamId = number;
export type ResourceId = string;

export interface Team {
  id: TeamId;
  name?: string;
}

export enum Track {
  ROBOT = "ROBOT",
  PRESENTATION = "PRESENTATION",
}

export enum AssignmentType {
  ROBOT_MATCH = "ROBOT_MATCH",
  PRESENTATION = "PRESENTATION",
}

export interface TimeWindow {
  startMs: EpochMs;
  endMs: EpochMs;
}

export interface TournamentSetup {
  teams: Team[];
  robotTablesCount: number;
  robotStartMs: EpochMs;
  robotEndMs: EpochMs;
  robotBreaks: TimeWindow[];
  presentationRoomsCount: number;
  presentationStartMs: EpochMs;
  presentationEndMs: EpochMs;
  presentationBreaks: TimeWindow[];
  minGapMinutes: number;
  suggestBreaks: boolean;
  suggestResources: boolean;
}

export interface Slot {
  id: SlotId;
  track: Track;
  startMs: EpochMs;
  endMs: EpochMs;
}

export interface Assignment {
  id: string;
  teamId: TeamId;
  type: AssignmentType;
  slotId: SlotId;
  resourceId: ResourceId;
  sequence: number | null;
}

export type SuggestionAction =
  | { action: "INCREASE_ROBOT_TABLES"; by?: number }
  | { action: "INCREASE_PRESENTATION_ROOMS"; by?: number }
  | { action: "EXTEND_ROBOT_END_TIME"; minutes?: number }
  | { action: "EXTEND_PRESENTATION_END_TIME"; minutes?: number }
  | { action: "REDUCE_MIN_GAP"; minutes?: number }
  | { action: "ADD_BREAK"; track: Track; window: TimeWindow }
  | { action: "ADJUST_BREAKS"; track: Track };

export interface ValidSchedule {
  slots: Slot[];
  assignments: Assignment[];
  warnings: string[];
}

export interface ScheduleFailure {
  errors: DomainError[];
  suggestions: SuggestionAction[];
}

export type ValidateSetupResult =
  | { ok: true }
  | { ok: false; errors: DomainError[] };

export type GenerateScheduleResult =
  | {
      ok: true;
      schedule: ValidSchedule;
    }
  | { ok: false; errors: DomainError[]; suggestions: SuggestionAction[] };
