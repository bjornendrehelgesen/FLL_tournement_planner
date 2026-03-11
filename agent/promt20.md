Step 20 goals:
Implement Auto-reshuffle for presentation moves:
- When user drops a presentation:
  - attempt to apply move
  - then run a repair routine that restores validity (no overlap + min gap + no resource conflicts)
  - if successful, commit
  - if impossible, revert and show reason (error code + short message)

Implementation:
- create engine function autoReshuffle(schedule, setup, move) that:
  - applies move on a copy
  - attempts to repair only what is needed (bounded)
  - validates final schedule (must be conflict-free)
Return:
- {ok:true, schedule} or {ok:false, reason:{code,message}}

Tests:
- case where auto-reshuffle can fix by moving one other presentation
- case where it cannot -> revert

Wire it in:
- Mode toggle now enables/disables auto behavior for presentations.

Done