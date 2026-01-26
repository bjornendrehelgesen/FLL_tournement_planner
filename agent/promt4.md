Step 4 goals:
Implement presentation slot generation in src/engine/slots/presentationSlots.ts:
Inputs:
- presentationStartTime, presentationEndTime
- presentationRoomsCount
- presentationBreaks
Output:
- array of Slot objects for track PRESENTATION
- each slot is 30 minutes
- slots must not overlap breaks (no slot whose time intersects any break)
- each slot.resources.roomIds = [1..roomsCount]
- deterministic IDs (e.g., derived from start time + track) so tests are stable

Unit tests:
- generates correct count with no breaks
- excludes slots that would intersect breaks
- room IDs correct
- all slots within window

Wire it in:
- In App, render “Presentation slots: X” for the hard-coded setup from earlier.