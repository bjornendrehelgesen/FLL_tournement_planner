Step 18.5 goals:
Add global robot sequencing constraint (phased robot assignment + validation).

Rules:
- All robot sequence=1 matches must finish before any sequence=2 starts.
- All robot sequence=2 matches must finish before any sequence=3 starts.
- Use >= boundary: sequence N+1 may start at the exact end time of sequence N.

Engine changes:
- Robot assignment is phased by sequence using ordered robot cells (slot start time then tableId).
- Phase 1 assigns sequence=1 for teams 1..N to earliest available cells; track phase1End.
- Phase 2 assigns sequence=2 using cells with slot.startMs >= phase1End; track phase2End.
- Phase 3 assigns sequence=3 using cells with slot.startMs >= phase2End.

Validator changes:
- Add conflict type ROBOT_SEQUENCE_ORDER_VIOLATION.
- Message: “Robot match 2 starts before all match 1 are completed.”
- Include helpful slotIds/teamIds when possible.

Tests:
- Robot assignment: exactly 3 matches per team, no table double-booking, and phase ordering.
- ValidateSchedule: detect ordering violation; allow boundary equality.

Done
