Step 19 goals:
Add drag/drop for robot assignments in robot grid:
- draggable: robot match cell
- droppable: robot grid cell (slotId+tableId)

Rules:
- only allow drops onto tables that are active for that slot (already implied by grid columns)
- swap if occupied
- keep the robot match sequence with the assignment (sequence stays 1..3)
- Manual mode allows conflicts, including the GLOBAL ROBOT SEQUENCING RULE:
  - all seq=1 must finish before any seq=2 starts; all seq=2 before any seq=3
  - after a move, schedule may become invalid; rely on Validate to show conflicts

Tests:
- move robot match to another slot/table updates assignment
- swap works
- sequence preserved
- invalid table drop is impossible (or rejected with no change)
- NEW: a move can result in a ROBOT_SEQUENCE_ORDER_VIOLATION being reported by validateSchedule
  (i.e., DnD should not “block” manual moves just because they violate sequencing)

Wire it in:
- Manual editing supports both tracks now.