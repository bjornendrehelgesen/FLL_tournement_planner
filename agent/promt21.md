Step 21 goals:
Extend Auto-reshuffle to robot moves:
- Same pattern as Step 20
- Must respect robot slot active table group rules
- Repair may move other robot matches (and possibly presentations only if necessary; define a strict rule and document it—prefer robot-only repairs first)

Tests:
- successful repair case
- failure case with revert
- post-condition validateSchedule returns no conflicts

Wire it in:
- Auto-reshuffle mode applies to both tracks.