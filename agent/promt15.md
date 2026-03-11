Step 15 goals:
Render the team-centric table:
Rows: teams 1..N
Columns:
- Presentation (time + room)
- Robot match 1 (time + table)
- Robot match 2
- Robot match 3
Requirements:
- derive per-team rows from assignments + slots
- stable sorting by teamId
- times formatted nicely

Tests:
- given a small schedule fixture, table shows correct cells

Wire it in:
- This becomes the default schedule view shown on success.

Done