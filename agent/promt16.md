Step 16 goals:
Render secondary views:
- Robot grid:
  - rows: robot slots chronologically
  - columns: active tables for that slot
  - each cell shows assigned teamId or empty
- Presentation grid:
  - rows: presentation slots
  - columns: rooms
  - each cell shows assigned teamId or empty

Tests:
- fixture schedule renders correctly with empty/filled cells

Wire it in:
- Add a simple tab switch: “Teams / Robot track / Presentation track”.

Done