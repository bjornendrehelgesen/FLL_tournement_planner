Step 8 goals:
Implement src/engine/assign/presentations.ts:
- Assign exactly 1 presentation per team.
- Deterministic strategy:
  - iterate teams 1..N
  - assign each team to the earliest available presentation slot/room (first-fit)
- Build assignments array with AssignmentType.PRESENTATION and resourceId=roomId
- Ensure no room double-booking per slot

Unit tests:
- N teams fit exactly in capacity
- correct distribution across slots/rooms
- deterministic output

Wire it in:
- Add src/engine/generateSchedule.ts that:
  - validates setup
  - generates slots
  - capacity checks
  - assigns presentations (only)
  - returns draft schedule object {slots, assignments, warnings:[]}
- App: button “Generate Draft” that uses hard-coded setup and shows count of presentation assignments.