Step 17 goals:
Add editing mode switch:
- Manual mode (default for now) and Auto-reshuffle (disabled for now)
Add “Validate schedule” button:
- calls validateSchedule(currentSchedule, setup)
- displays conflict list with messages like in spec
Highlighting:
- when conflicts exist, highlight affected teams in team table and affected cells in track grids (basic CSS class is fine)

Tests:
- conflict list appears with correct messages for a known invalid schedule state

Wire it in:
- Mode switch + validate action are visible in Schedule view.

Done