Step 24 goals:
Add Playwright tests:
1) Happy path:
- enter teams, set times/resources
- generate schedule
- verify “Valid schedule generated” and team table rows == N
2) Manual edit path:
- switch to presentation track
- drag a team to another cell
- click Validate and see conflicts (or see no conflicts if moved safely, depending on scenario you set up)
3) Persistence path:
- save setup
- reload page
- ensure setup restored (last opened)

Wire it in:
- Ensure npm run test:e2e runs these tests headlessly.