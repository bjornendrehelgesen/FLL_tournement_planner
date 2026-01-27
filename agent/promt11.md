Step 11 goals:
Add a bounded repair mechanism in src/engine/repair/repairLoop.ts:
- When placement fails for a team/event, attempt limited repairs:
  - try swapping with an assignment in a candidate slot
  - try moving a conflicting assignment to the next available valid cell
- Keep it deterministic:
  - fixed search order
  - bounded attempts (e.g., max 500 operations) to avoid UI freezes
- If repair fails, return the same structured failure as before.

Unit + perf-ish tests:
- a case that requires a swap to succeed
- ensure the attempt bound is respected
- basic performance: 60 teams completes within a reasonable test time budget (use a generous threshold)

Wire it in:
- generateSchedule uses repairLoop by default.
- App unchanged besides benefitting from improved success rate.

Done