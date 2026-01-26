Step 10 goals:
Upgrade generateSchedule.ts to enforce:
- a team’s events never overlap across both tracks
- min gap >= min_gap_minutes between any two events for a team

Implementation guidance:
- Maintain a per-team “calendar” of assigned intervals.
- When placing an assignment, check:
  - overlap with existing intervals
  - gap vs nearest neighbors
- Modify the assignment algorithm:
  - Keep presentation assignment first, but allow choosing later slots if earlier ones violate min-gap due to already placed events.
  - Then assign robot matches with the same constraint checks.

Failure behavior:
- If no valid placement exists, return a failure:
  - NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS or UNSATISFIABLE_OVERLAP_CONSTRAINTS
  - include actionable suggestions (increase resources, extend time windows, reduce min gap if >15)

Unit tests:
- a setup where naive placement would violate gap, but a feasible rearrangement exists
- a setup where gap makes it impossible -> correct failure code
- asserts scheduleValidator returns zero conflicts for successful schedules

Wire it in:
- App “Generate schedule” should show either “Schedule valid” or structured error codes + suggestion labels.