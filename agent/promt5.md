Step 5 goals:
Implement robot slot generation in src/engine/slots/robotSlots.ts:
Inputs:
- robotStartTime, robotEndTime
- robotTablesCount
- robotBreaks
Rules:
- slot duration 5 minutes
- alternate active table groups A (odd) and B (even) each slot index (1-based)
- for each slot, slot.resources.tableIds should contain only the active group’s table IDs
- if tablesCount=1, group A is [1], group B is [] but still alternate (slots with empty tables should be allowed or filtered—choose and document; prefer filtering them out to avoid useless capacity)
- exclude slots intersecting breaks

Unit tests:
- group alternation for T=1,2,3,4,6
- breaks exclusion correctness
- capacity implied by tableIds lengths

Wire it in:
- In App, render “Robot slots: X” and “Robot capacity: Y (sum of active tables)” for the hard-coded setup.

Done