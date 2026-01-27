Step 14 goals:
Implement schedule result rendering:
- If success:
  - show “Valid schedule generated”
  - show counts and a warnings panel (even if empty)
- If failure:
  - show error codes and human messages
  - show suggestions list (just text + optional “apply” buttons stubbed)

Tests:
- render success path with a mocked engine result
- render failure path with errors/suggestions

Wire it in:
- Real generateSchedule output displayed through this UI.

Done