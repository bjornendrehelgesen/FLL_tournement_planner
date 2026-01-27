Step 3 goals:
Implement setup validation per spec in src/engine/validateSetup.ts:
- Validate number_of_teams > 1
- tables/rooms >= 1
- start < end for robot & presentation windows
- min_gap_minutes >= 15 (reject < 15)
- break intervals:
  - start < end
  - within the corresponding window
  - no overlaps among breaks in the same track
Return a structured result:
- { ok: true } OR { ok:false, errors:[{code, message, path}], ... }

Write thorough unit tests:
- happy path
- each invalid condition
- break overlap and break outside window cases

Wire it in:
- Add a tiny function in App that calls validateSetup on a hard-coded setup and renders “Setup OK” vs first error code.
- Keep UI minimal; we just want validation integrated.

done