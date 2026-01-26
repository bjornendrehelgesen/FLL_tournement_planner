Step 18 goals:
Add drag/drop for presentation assignments in the presentation grid:
- draggable: a presentation cell with a team
- droppable: any presentation cell (slotId+roomId)
Manual rules:
- allow move even if it creates conflicts
- update assignments accordingly (move team to new slot/room)
- if target occupied, swap teams (simple deterministic swap)
- after move, do not auto-fix; just mark schedule as “dirty” and let Validate show conflicts

Tests:
- drag A onto empty cell moves assignment
- drag A onto occupied cell swaps
- assignments updated correctly

Wire it in:
- dnd-kit integrated only for presentations in this step.