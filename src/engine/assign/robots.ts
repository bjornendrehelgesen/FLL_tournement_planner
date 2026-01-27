import type { Assignment, Slot, Team } from "../../domain";
import { AssignmentType, Track } from "../../domain";

const MATCHES_PER_TEAM = 3;

interface AssignRobotMatchesInput {
  teams: Team[];
  slots: Slot[];
}

interface RobotCell {
  slotId: string;
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
      cells.push({ slotId: slot.id, tableId });
    }
  }

  return cells;
}

function cellKey(cell: RobotCell): string {
  return `${cell.slotId}::${cell.tableId}`;
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

  for (let sequence = 1; sequence <= MATCHES_PER_TEAM; sequence += 1) {
    for (const team of orderedTeams) {
      const usedSlots = slotsByTeam.get(team.id) ?? new Set<string>();
      const cell = cells.find(
        (candidate) =>
          !usedCells.has(cellKey(candidate)) &&
          !usedSlots.has(candidate.slotId),
      );

      if (!cell) {
        throw new Error(`No robot slot available for team ${team.id}.`);
      }

      usedCells.add(cellKey(cell));
      usedSlots.add(cell.slotId);
      slotsByTeam.set(team.id, usedSlots);

      assignments.push({
        id: `robot-${team.id}-${cell.slotId}-${cell.tableId}-${sequence}`,
        teamId: team.id,
        type: AssignmentType.ROBOT_MATCH,
        slotId: cell.slotId,
        resourceId: String(cell.tableId),
        sequence,
      });
    }
  }

  return assignments;
}
