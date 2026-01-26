Step 19 goals:
Add drag/drop for robot assignments in robot grid:
- draggable: robot match cell
- droppable: robot grid cell (slotId+tableId)
Rules:
- only allow drops onto tables that are active for that slot (already implied by grid columns)
- swap if occupied
- keep the robot match sequence with the assignment (sequence stays 1..3)
- after move, schedule may become invalid; rely on Validate

Tests:
- move robot match to another slot/table updates assignment
- swap works
- sequence preserved
- invalid table drop is impossible (or rejected with no change)

Wire it in:
- Manual editing supports both tracks now.