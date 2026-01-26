Step 12 goals:
Add fast-check property tests in src/engine/__property__/schedule.property.test.ts:
Generate random but valid-ish setups:
- teams between 2..40
- time windows sized to sometimes be feasible and sometimes not
- random breaks (non-overlapping, within windows)
- min_gap_minutes between 15..45
Assert for ok schedules:
- exactly N presentations and 3N robot matches
- no conflicts from validateSchedule
- all assignments correspond to existing slots and valid resources
For failure schedules:
- errors are structured and one of the known codes

Wire it in:
- Ensure “npm test” runs both unit and property tests (or add separate script but keep CI default strong).