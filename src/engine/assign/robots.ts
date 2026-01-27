import type { Assignment, Slot, Team } from "../../domain";
import { AssignmentType, Track } from "../../domain";

const MATCHES_PER_TEAM = 3;

interface AssignRobotMatchesInput {
  teams: Team[];
  slots: Slot[];
}

interface RobotCell {
  slot: Slot;
  tableId: number;
}

function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.id - b.id);
}

function sortSlots(slots: Slot[]): Slot[] {
  return [...slots]
    .filter((slot) => slot.track === Track.ROBOT)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

function buildCells(slots: Slot[]): RobotCell[] {
  const cells: RobotCell[] = [];

  for (const slot of slots) {
    const tableIds = [...(slot.resources.tableIds ?? [])].sort((a, b) => a - b);
    for (const tableId of tableIds) {
      cells.push({ slot, tableId });
    }
  }

  return cells;
}

function cellKey(cell: RobotCell): string {
  return `${cell.slot.id}::${cell.tableId}`;
}

export function assignRobotMatches({
  teams,
  slots,
}: AssignRobotMatchesInput): Assignment[] {
  const assignments: Assignment[] = [];
  const orderedTeams = sortTeams(teams);
  const orderedSlots = sortSlots(slots);
  const cells = buildCells(orderedSlots);
  const usedCells = new Set<string>();
  const slotsByTeam = new Map<number, Set<string>>();

  let minStartMs = Number.NEGATIVE_INFINITY;

  for (let sequence = 1; sequence <= MATCHES_PER_TEAM; sequence += 1) {
    let phaseEndMs = minStartMs;
    for (const team of orderedTeams) {
      const usedSlots = slotsByTeam.get(team.id) ?? new Set<string>();
      const cell = cells.find(
        (candidate) =>
          candidate.slot.startMs >= minStartMs &&
          !usedCells.has(cellKey(candidate)) &&
          !usedSlots.has(candidate.slot.id),
      );

      if (!cell) {
        throw new Error(`No robot slot available for team ${team.id}.`);
      }

      usedCells.add(cellKey(cell));
      usedSlots.add(cell.slot.id);
      slotsByTeam.set(team.id, usedSlots);
      if (cell.slot.endMs > phaseEndMs) {
        phaseEndMs = cell.slot.endMs;
      }

      assignments.push({
        id: `robot-${team.id}-${cell.slot.id}-${cell.tableId}-${sequence}`,
        teamId: team.id,
        type: AssignmentType.ROBOT_MATCH,
        slotId: cell.slot.id,
        resourceId: String(cell.tableId),
        sequence,
      });
    }

    minStartMs = phaseEndMs;
  }

  return assignments;
}
