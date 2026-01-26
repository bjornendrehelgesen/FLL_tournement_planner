Step 13 goals:
Build the actual setup UI (no drag/drop yet):
- Quick start: number_of_teams (required)
- Settings panel:
  - robot tables count, start/end datetime-local, breaks editor list
  - presentation rooms count, start/end datetime-local, breaks editor list
  - min gap minutes (>=15)
  - toggles suggest_breaks, suggest_resources (store them but can be no-op yet)
- Inline validation:
  - call validateSetup on change
  - show field-level error summaries and disable Generate if invalid

Testing:
- Component/unit tests for validation behavior (Vitest + Testing Library acceptable)
- Keep styles minimal but clear

Wire it in:
- App uses stateful setup from UI, not hard-coded values.
- Generate button calls generateSchedule(setup) and stores result in state.