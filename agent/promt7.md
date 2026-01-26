Step 7 goals:
Implement schedule validation in src/engine/validateSchedule.ts:
Inputs:
- setup
- slots (robot + presentation)
- assignments
Output:
- list of conflicts with structured fields:
  - type: OVERLAP | MIN_GAP | DOUBLE_BOOK_RESOURCE | OUTSIDE_WINDOW | IN_BREAK
  - human message (per spec style)
  - involved teamId(s), slotId(s), resourceId(s)

Rules:
- Team conflicts: any overlap between that team’s events (robot vs robot, robot vs presentation, etc.)
- Min gap: for consecutive events for a team, gap must be >= min_gap_minutes
- Resource conflicts:
  - within same slot, a table/room cannot be assigned to multiple teams
- Must detect assignments using wrong resource group (robot match assigned to a table not in that slot’s tableIds)

Unit tests:
- each conflict type in isolation
- multiple conflicts returned
- empty conflicts for valid simple schedule

Wire it in:
- Create a small hard-coded invalid schedule in App and render “Conflicts: X”.