Step 9 goals:
Implement src/engine/assign/robots.ts:
- Assign exactly 3 robot matches per team.
- Deterministic approach:
  - create a list of all robot “resource cells” (slotId + tableId) in chronological order
  - allocate matches in round-robin so teams are spread:
    - for match sequence 1..3:
      - for team 1..N:
        - pick the next available cell that does not already contain that team (avoid same slot duplication)
- Ensure no table double-booking and respects slot’s active table group.

Unit tests:
- each team gets exactly 3 robot matches
- no resource double-booking
- assignments use valid table for the slot
- deterministic output

Wire it in:
- Update generateSchedule.ts to also assign robot matches.
- App should display counts: presentations=N, robot=3N, total=4N.

in prosess