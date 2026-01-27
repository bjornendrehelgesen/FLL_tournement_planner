Step 6 goals:
Create src/engine/feasibility/capacityCheck.ts:
- Compute robotCapacity = sum over robotSlots of active tableIds count
- Compute presentationCapacity = presentationSlotsCount * roomsCount
- Requirements: robot need = 3*N, presentation need = 1*N
Return:
- ok:true if both sufficient
- else ok:false with structured errors:
  - INSUFFICIENT_ROBOT_CAPACITY and/or INSUFFICIENT_PRESENTATION_CAPACITY
Include suggestions array with actions like:
- increase tables/rooms
- extend end time (robot/presentation)
- reduce min gap (but never below 15) — only suggest if min_gap_minutes > 15

Unit tests:
- exact boundary conditions
- both insufficient
- suggestions present and sensible

Wire it in:
- App should show either “Capacity OK” or list the feasibility error codes.

Done