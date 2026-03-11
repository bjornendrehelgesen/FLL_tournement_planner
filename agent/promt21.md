Step 21 goals:
Extend Auto-reshuffle to robot moves:
- Same pattern as Step 20
- Must respect robot slot active table group rules
- Must also enforce the GLOBAL ROBOT SEQUENCING RULE as a hard constraint in auto mode:
  - all robot seq=1 matches (across all teams) must finish before any seq=2 starts
  - all seq=2 must finish before any seq=3 starts
  - auto-reshuffle must only commit if the final schedule satisfies this rule
- Repair may move other robot matches (and possibly presentations only if necessary; define a strict rule and document it—prefer robot-only repairs first)

Behavior:
- On drop in auto mode:
  - apply the move to a copy
  - run bounded repair to restore a fully valid schedule (including min-gap, overlaps, resource constraints, and robot sequencing phases)
  - if repair succeeds, commit the new schedule
  - if impossible, revert and show a reason

Tests:
- successful repair case (robot move triggers reshuffle but ends in a fully valid schedule)
- failure case with revert (robot move cannot be repaired without violating constraints)
- post-condition validateSchedule returns no conflicts (including no ROBOT_SEQUENCE_ORDER_VIOLATION)
- NEW: specifically test that auto-reshuffle will not commit a schedule that violates global robot sequencing

Wire it in:
- Auto-reshuffle mode applies to both tracks.

Done