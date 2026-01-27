# FIRST LEGO League Tournament Planner (v1) — TODO Checklist

> Use this as an implementation checklist. Items are ordered for incremental, test-driven progress.
> “Done” means: implemented, tested, and wired into the app (no orphan code).

---

## 0) Repo + Quality Baseline

- [x] Create Vite + React + TypeScript app
- [ ] Add formatting/linting (optional but recommended)
  - [x] ESLint configured for TS/React
  - [ ] Prettier configured
  - [ ] `lint` script passes
- [ ] Add testing toolchain
  - [x] Vitest configured
  - [x] Testing Library configured (if using component tests)
  - [x] fast-check configured (property tests)
  - [x] Playwright configured (e2e)
- [ ] Add npm scripts:
  - [x] `test`
  - [x] `test:watch`
  - [x] `test:e2e`
  - [x] `build`
  - [x] `dev`
- [x] Minimal App renders “FLL Tournament Planner”
- [x] Unit smoke test: App header renders
- [x] Playwright smoke test: page loads and finds header text

---

## 1) Domain Model + Utilities

### 1.1 Domain types
- [x] Create `src/domain/` and export barrel `src/domain/index.ts`
- [x] Define core types (aligning with spec):
  - [x] `TournamentSetup`
  - [x] `Slot`
  - [x] `Assignment`
  - [x] Enums: `Track`, `AssignmentType`
- [x] Define breaks type:
  - [x] `BreakInterval { start, end }`
- [x] Define schedule result types:
  - [x] `ValidSchedule { slots, assignments, warnings }`
  - [x] `ScheduleFailure { errors, suggestions }`

### 1.2 Errors + suggestions model
- [x] Define validation error model:
  - [x] `ValidationError { code, message, path }`
- [x] Define feasibility error codes (from spec):
  - [x] `INSUFFICIENT_ROBOT_CAPACITY`
  - [x] `INSUFFICIENT_PRESENTATION_CAPACITY`
  - [x] `NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS`
  - [x] `UNSATISFIABLE_OVERLAP_CONSTRAINTS`
- [x] Define input validation error codes (from spec):
  - [x] teams <= 1
  - [x] tables/rooms < 1
  - [x] start >= end
  - [x] breaks invalid (start>=end, outside window, overlaps)
  - [x] min gap < 15
- [x] Define suggestion actions:
  - [x] Increase tables
  - [x] Increase rooms
  - [x] Extend robot end time
  - [x] Extend presentation end time
  - [x] Reduce min gap (only if > 15)
  - [x] Apply suggested breaks (requires acceptance)

### 1.3 Time representation + helpers (choose one consistently)
- [x] Decide: store times as epoch ms or ISO strings (document it)
- [x] Implement `src/domain/time/*` helpers:
  - [x] `addMinutes`
  - [x] `diffMinutes`
  - [x] `overlaps(intervalA, intervalB)`
  - [x] `withinWindow(time, start, end)`
  - [x] parsing/format helpers for `datetime-local`
- [x] Unit tests for time helpers (edge cases around boundaries)

---

## 2) Setup Validation (TDD)

- [x] Implement `validateSetup(setup)` returning `{ok:true}` or `{ok:false, errors:[...]}`

### 2.1 Required fields + numeric constraints
- [x] Reject `numberOfTeams <= 1`
- [x] Reject `robotTablesCount < 1`
- [x] Reject `presentationRoomsCount < 1`
- [x] Reject `minGapMinutes < 15`

### 2.2 Window constraints
- [x] Robot: reject `robotStartTime >= robotEndTime`
- [x] Presentation: reject `presentationStartTime >= presentationEndTime`

### 2.3 Break validation (per track)
- [x] Reject break with `start >= end`
- [x] Reject break outside window (start < window start OR end > window end)
- [x] Reject overlapping breaks within the same track
- [ ] Allow adjacent breaks that touch (end == start) (decide and test)
- [ ] Unit tests: each validation scenario with clear `path`s

### 2.4 Wire validation into UI (temporary)
- [x] App calls `validateSetup` on a hard-coded setup and renders “Setup OK” or first error code

---

## 3) Slot Generation (TDD)

### 3.1 Presentation slots (30 minutes)
- [x] Implement `generatePresentationSlots(setup)`:
  - [x] Create sequential 30-minute slots within window
  - [x] Exclude any slot intersecting a break interval
  - [x] Include `roomIds = [1..roomsCount]` per slot
  - [x] Deterministic slot IDs (stable for tests)
- [x] Unit tests:
  - [x] correct slot count with no breaks
  - [x] excluded slots that intersect breaks
  - [x] all slots within window
  - [x] roomIds correct

### 3.2 Robot slots (5 minutes) + A/B table alternation
- [x] Implement `generateRobotSlots(setup)`:
  - [x] Create sequential 5-minute slots within window
  - [x] Exclude any slot intersecting a break interval
  - [x] Determine active tables each slot by alternation:
    - [x] Group A: odd tables
    - [x] Group B: even tables
    - [x] Slot 1 uses A, slot 2 uses B, slot 3 uses A...
  - [x] Decide behavior for empty group (e.g., T=1 gives groupB empty):
    - [x] Prefer filtering out empty-table slots (document + test)
  - [x] Deterministic slot IDs
- [x] Unit tests:
  - [x] A/B alternation correct for T=1,2,3,4,6
  - [x] breaks exclusion correct
  - [x] tableIds only include active group for that slot
  - [x] expectations account for skipped empty-group slots

### 3.3 Wire into UI (temporary)
- [x] App displays counts: robot slots, presentation slots, robot capacity (sum of tableIds)

---

## 4) Capacity + Feasibility Checks (TDD)

- [x] Implement `capacityCheck(setup, robotSlots, presentationSlots)`:
  - [x] robot capacity = sum(slot.tableIds.length)
  - [x] presentation capacity = presentationSlots.length * roomsCount
  - [x] need robot = 3 * N
  - [x] need presentation = 1 * N
- [x] Return `{ok:true}` or `{ok:false, errors:[...], suggestions:[...]}`

### 4.1 Suggestions
- [x] If insufficient robot capacity:
  - [x] Suggest increase tables and/or extend robot end time
- [x] If insufficient presentation capacity:
  - [x] Suggest increase rooms and/or extend presentation end time
- [x] If `minGapMinutes > 15`, optionally suggest reducing (never below 15)

### 4.2 Tests
- [x] Boundary cases (exactly enough)
- [x] Robot insufficient
- [x] Presentation insufficient
- [x] Both insufficient
- [x] Suggestions appear correctly

### 4.3 Wire into UI (temporary)
- [x] App shows “Capacity OK” or lists feasibility errors

---

## 5) Schedule Validator (Manual mode foundation) (TDD)

- [x] Implement `validateSchedule(setup, slots, assignments)` returning `conflicts[]`

### 5.1 Conflict types
- [x] Team overlap (any overlap across team events)
- [x] Min gap violations across any two consecutive team events
- [x] Resource double-booking:
  - [x] Same slot + same table used twice
  - [x] Same slot + same room used twice
- [x] Invalid robot resource usage:
  - [x] robot assignment uses tableId not in that slot.tableIds
- [x] Assignment outside window or inside break (if possible from editing)

### 5.2 Message formatting (human readable)
- [x] Example overlap message: “Team 7 presentation overlaps robot match at 10:30”
- [x] Example gap message: “Team 4 gap between events is 10 minutes; minimum is 15”

### 5.3 Tests
- [x] Each conflict type isolated
- [x] Multiple conflicts returned
- [x] No conflicts for a known valid schedule fixture

### 5.4 Wire into UI (temporary)
- [x] App renders “Conflicts: X” for a hard-coded invalid example

---

## 6) Scheduling Engine v0 → v1 (TDD)

### 6.1 Engine output contract
- [x] Implement `generateSchedule(setup)` that returns:
  - [x] `ValidSchedule` (slots + assignments + warnings)
  - [x] OR `ScheduleFailure` (errors + suggestions)
- [x] Ensure deterministic behavior (stable ordering)

### 6.2 Assign presentations first (simple first-fit)
- [x] Implement `assignPresentations(setup, presentationSlots)`:
  - [x] Teams 1..N
  - [x] Earliest available slot/room first-fit
  - [x] No room double-booking in same slot
- [x] Tests:
  - [x] N teams assigned exactly once
  - [x] deterministic mapping
  - [x] respects capacity (assume checked earlier)

### 6.3 Assign robots (3 matches per team)
- [x] Implement `assignRobotMatches(setup, robotSlots)`:
  - [x] Build ordered list of “cells” = (slotId, tableId)
  - [x] Allocate matches in round-robin:
    - [x] For sequence 1..3, for team 1..N, pick next available cell
  - [x] No table double-booking
  - [x] Sequence preserved (1..3)
- [x] Tests:
  - [x] each team gets exactly 3 robot matches
  - [x] no double-booking
  - [x] assigned table is valid for that slot
  - [x] deterministic output

### 6.4 Enforce hard constraints (v1 core)
- [x] Add per-team calendar checks during assignment:
  - [x] no overlaps across tracks
  - [x] min gap across tracks and within track
- [x] If placement fails:
  - [x] return structured failure code:
    - [x] `NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS` or `UNSATISFIABLE_OVERLAP_CONSTRAINTS`
  - [x] include actionable suggestions
- [x] Tests:
  - [x] case where naive would violate gap but alternative placement exists
  - [x] case where gap makes schedule impossible → failure code
  - [x] success schedules have `validateSchedule` = no conflicts

### 6.5 Repair loop (robustness)
- [ ] Implement bounded repair mechanism:
  - [ ] local swaps
  - [ ] move conflicting assignment to next valid cell
  - [ ] bounded attempts with deterministic order
- [ ] Tests:
  - [ ] scenario requiring swap to succeed
  - [ ] failure when bound exceeded
  - [ ] performance sanity (e.g., 60 teams completes under a generous limit)

---

## 7) Property-Based Testing (Engine)

- [x] Add fast-check property tests that generate random setups:
  - [x] teams 2..40
  - [x] minGap 15..45
  - [x] windows sometimes tight to induce failure
  - [x] random non-overlapping breaks within windows
- [x] For successful schedules assert invariants:
  - [x] exactly N presentations
  - [x] exactly 3N robot matches
  - [x] `validateSchedule` returns no conflicts
  - [x] assignments reference valid slot/resource
- [x] For failures assert:
  - [x] structured error codes only
  - [ ] suggestions present when applicable
- [x] Ensure property tests are part of default `npm test` (or a strong CI script)

---

## 8) UI v1: Setup Flow (Real Inputs)

### 8.1 Quick start screen
- [ ] Field: `numberOfTeams`
- [ ] Optional recommended resources area (placeholder for now)
- [ ] “Generate schedule” button

### 8.2 Settings panel
Robot track:
- [ ] `robotTablesCount`
- [ ] `robotStartTime` / `robotEndTime` (`datetime-local`)
- [ ] Breaks editor:
  - [ ] add break
  - [ ] edit start/end
  - [ ] delete break
Presentation track:
- [ ] `presentationRoomsCount`
- [ ] `presentationStartTime` / `presentationEndTime`
- [ ] Breaks editor
Shared:
- [ ] `minGapMinutes` (enforce >=15 in UI + validation)
Toggles:
- [ ] `suggestBreaks`
- [ ] `suggestResources`

### 8.3 Inline validation UX
- [ ] Validate on change
- [ ] Show field-level or section-level errors
- [ ] Disable Generate if invalid setup

---

## 9) UI: Schedule Rendering

### 9.1 Result state (success/failure)
- [x] On success:
  - [x] show “Valid schedule generated”
  - [x] show counts and warnings (if any)
- [x] On failure:
  - [x] show error list (code + human message)
  - [x] show suggestions list (text)
  - [x] add “apply suggestion” buttons (may be stub at first)

### 9.2 Team-centric table (primary)
- [x] Rows: teams 1..N
- [ ] Columns:
  - [x] Presentation time + room
  - [x] Robot match 1 time + table
  - [x] Robot match 2 time + table
  - [x] Robot match 3 time + table
- [x] Sorting stable by teamId
- [x] Nice time formatting

### 9.3 Track grids (secondary)
- [x] Tabs: Teams / Robot track / Presentation track
- [x] Robot grid:
  - [x] rows = robot slots
  - [x] columns = active tables for that slot
  - [x] cells show team or empty
- [x] Presentation grid:
  - [x] rows = presentation slots
  - [x] columns = rooms
  - [x] cells show team or empty

### 9.4 Tests
- [x] Render test for result state (success/failure)
- [x] Render test for team table from fixture schedule
- [x] Render test for robot/presentation grids from fixture schedule

---

## 10) Editing Modes + Validation UI

### 10.1 Mode switch + validate action
- [ ] Toggle: Manual / Auto-reshuffle
- [ ] Button: “Validate schedule”
- [ ] Conflict list panel:
  - [ ] overlaps
  - [ ] min gap violations
  - [ ] double-booking
  - [ ] invalid resource usage
- [ ] Visual highlighting:
  - [ ] highlight affected team rows
  - [ ] highlight affected grid cells

### 10.2 Tests
- [ ] Known-invalid schedule shows expected conflicts
- [ ] Highlight markers appear for conflict targets

---

## 11) Drag & Drop — Manual Mode

### 11.1 Presentation moves (manual)
- [ ] Add dnd-kit
- [ ] Drag a team’s presentation to another slot/room
- [ ] If target occupied: swap
- [ ] Allow conflicts (do not auto-fix)
- [ ] Mark schedule dirty (optional indicator)
- [ ] Tests:
  - [ ] move to empty cell
  - [ ] swap
  - [ ] assignments updated correctly

### 11.2 Robot moves (manual)
- [ ] Drag a robot match to another slot/table
- [ ] If target occupied: swap
- [ ] Preserve `sequence` (1..3)
- [ ] Ensure drop targets only exist for active tables
- [ ] Allow conflicts
- [ ] Tests:
  - [ ] move
  - [ ] swap
  - [ ] sequence preserved
  - [ ] no invalid table drops

---

## 12) Drag & Drop — Auto-Reshuffle Mode

### 12.1 Auto-reshuffle for presentations
- [ ] Implement `autoReshuffle(schedule, setup, move)` in engine:
  - [ ] apply move on copy
  - [ ] bounded repair to restore validity
  - [ ] if success commit
  - [ ] if fail revert + show reason
- [ ] Tests:
  - [ ] successful repair case
  - [ ] failure case reverts and emits reason

### 12.2 Auto-reshuffle for robots
- [ ] Extend autoReshuffle to robot moves
- [ ] Prefer robot-only repairs first (document behavior)
- [ ] Tests:
  - [ ] success
  - [ ] failure/revert
  - [ ] post-condition: validateSchedule has zero conflicts

---

## 13) Persistence (v1 requirement)

### 13.1 Repository
- [ ] Implement local storage repository:
  - [ ] `listSetups()`
  - [ ] `saveSetup(setup)`
  - [ ] `loadSetup(id)`
  - [ ] `deleteSetup(id)`
  - [ ] `setLastOpened(id)`
  - [ ] `getLastOpened()`

### 13.2 UI wiring
- [ ] Save setup (optional name)
- [ ] Load setup (list/dropdown)
- [ ] Delete setup
- [ ] On app start, load last-opened automatically (if any)

### 13.3 Tests
- [ ] repository unit tests with mocked localStorage
- [ ] UI test: save → reload page → setup restored

---

## 14) Recommendations (v1 minimal, explainable)

### 14.1 suggest_resources
- [ ] If capacity insufficient:
  - [ ] compute minimal additional tables/rooms to meet capacity
  - [ ] or minimal window extension to meet capacity
- [ ] Present as suggestions (no auto changes)

### 14.2 suggest_breaks (minimal heuristic)
- [ ] Add explainable heuristic:
  - [ ] if min-gap feasibility fails due to track misalignment, suggest a short buffer break at a specific time
- [ ] Ensure suggestions only appear when toggle enabled

### 14.3 Tests
- [ ] suggestions appear only when toggles on
- [ ] capacity-based suggestion correctness
- [ ] break suggestion is explainable (message includes why)

---

## 15) E2E Testing (Playwright)

- [ ] Happy path:
  - [ ] fill setup
  - [ ] generate schedule
  - [ ] verify “Valid schedule generated”
  - [ ] verify team table rows == N
- [ ] Manual edit path:
  - [ ] drag a presentation to another cell
  - [ ] validate and see conflicts (or see none for chosen scenario)
- [ ] Persistence path:
  - [ ] save setup
  - [ ] reload
  - [ ] verify restored values
- [ ] Run e2e headlessly in CI mode

---

## 16) Performance + Polish (v1 Definition of Done)

- [ ] Performance checks:
  - [ ] generation for 60–120 teams is responsive
  - [ ] drag/drop remains responsive
- [ ] UX polish:
  - [ ] clear errors at top + details
  - [ ] suggestions shown with one-click apply where safe (optional in v1)
  - [ ] warnings panel (even if empty)
- [ ] Definition of Done checklist:
  - [ ] configurable setup (teams, tables/rooms, windows, breaks, min gap >=15)
  - [ ] generates schedule meeting all hard constraints
  - [ ] team-centric table view works
  - [ ] track grids work
  - [ ] manual mode + validate conflicts
  - [ ] auto-reshuffle mode keeps schedule valid or reverts with reason
  - [ ] setups saved/loaded locally

---
