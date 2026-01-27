import type { Assignment, Slot, Team } from "../../domain";
import { AssignmentType, Track } from "../../domain";

interface AssignPresentationsInput {
  teams: Team[];
  slots: Slot[];
}

function sortTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.id - b.id);
}

function sortSlots(slots: Slot[]): Slot[] {
  return [...slots]
    .filter((slot) => slot.track === Track.PRESENTATION)
    .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id));
}

export function assignPresentations({
  teams,
  slots,
}: AssignPresentationsInput): Assignment[] {
  const assignments: Assignment[] = [];
  const orderedTeams = sortTeams(teams);
  const orderedSlots = sortSlots(slots);
  const takenRoomsBySlot = new Map<string, Set<number>>();

  for (const team of orderedTeams) {
    let assigned = false;

    for (const slot of orderedSlots) {
      const roomIds = slot.resources.roomIds ?? [];
      if (roomIds.length === 0) continue;

      const taken = takenRoomsBySlot.get(slot.id) ?? new Set<number>();
      const availableRoom = roomIds.find((roomId) => !taken.has(roomId));

      if (availableRoom === undefined) {
        continue;
      }

      taken.add(availableRoom);
      takenRoomsBySlot.set(slot.id, taken);

      assignments.push({
        id: `presentation-${team.id}-${slot.id}-${availableRoom}`,
        teamId: team.id,
        type: AssignmentType.PRESENTATION,
        slotId: slot.id,
        resourceId: String(availableRoom),
        sequence: null,
      });

      assigned = true;
      break;
    }

    if (!assigned) {
      throw new Error(`No presentation slot available for team ${team.id}.`);
    }
  }

  return assignments;
}
