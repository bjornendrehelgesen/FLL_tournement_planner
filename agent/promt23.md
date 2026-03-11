Step 23 goals:
Implement minimal recommendations:
A) suggest_resources:
- If capacity insufficient, compute the smallest increase in:
  - robotTablesCount OR presentationRoomsCount OR end times
to satisfy pure capacity (ignore gap), and present as suggestion items.

B) suggest_breaks (minimal v1):
- If robot and presentation slot boundaries are badly misaligned for min-gap feasibility, suggest adding a short buffer break at a specific time (explain: “creates separation between tracks”).
- Must NOT auto-apply; only return as suggestions.

Tests:
- capacity-based suggestions computed correctly
- break suggestion only appears when toggle on and heuristic triggers

Wire it in:
- Failure UI shows these suggestions only when toggles enabled in setup.

Done