Step 2 goals:
- Create domain types in src/domain:
  - TournamentSetup, Slot, Assignment
  - enums Track: ROBOT/PRESENTATION, AssignmentType: ROBOT_MATCH/PRESENTATION
  - structured error codes from spec (input + feasibility)
  - suggestion actions type (e.g., INCREASE_TABLES, EXTEND_END_TIME, etc.)
- Create time helpers in src/domain/time:
  - parse/format helpers suitable for local datetime inputs
  - addMinutes, diffMinutes, overlaps(a,b), withinWindow, etc.
  - represent times as ISO strings or epoch ms consistently (choose one and document).
- Unit tests for time helpers and type guards (if any).

Constraints:
- Keep logic pure and deterministic.
- No UI changes except ensure build passes.

Wire it in:
- Export domain index from src/domain/index.ts
- Ensure tests import from the public exports, not deep paths where possible.

Reminder: After completing tasks, check off relevant items in agent/todo.md.
