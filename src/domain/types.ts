import type { DomainError } from "./errors";

export type EpochMs = number;
export type TrackId = string;
export type SlotId = string;

export interface Team {
  id: string;
  name: string;
}

export interface TournamentSetup {
  teams: Team[];
  tracks: TrackId[];
  startMs: EpochMs;
  slotDurationMs: number;
}

export interface Slot {
  id: SlotId;
  track: TrackId;
  startMs: EpochMs;
  durationMs: number;
}

export type AssignmentType = "match" | "judging" | "practice";

export interface Assignment {
  id: string;
  teamId: string;
  type: AssignmentType;
  sequence: number;
  slotId: SlotId;
}

export interface Schedule {
  slots: Slot[];
  assignments: Assignment[];
  warnings: string[];
}

export type ValidateSetupResult =
  | { ok: true }
  | { ok: false; errors: DomainError[] };

export type GenerateScheduleResult =
  | {
      ok: true;
      schedule: Schedule;
    }
  | { ok: false; errors: DomainError[] };
