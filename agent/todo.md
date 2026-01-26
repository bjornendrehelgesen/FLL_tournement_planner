# FIRST LEGO League Tournament Planner (v1) — TODO Checklist

> Use this as an implementation checklist. Items are ordered for incremental, test-driven progress.
> “Done” means: implemented, tested, and wired into the app (no orphan code).

---

## 0) Repo + Quality Baseline

- [ ] Create Vite + React + TypeScript app
- [ ] Add formatting/linting (optional but recommended)
  - [ ] ESLint configured for TS/React
  - [ ] Prettier configured
  - [ ] `lint` script passes
- [ ] Add testing toolchain
  - [ ] Vitest configured
  - [ ] Testing Library configured (if using component tests)
  - [ ] fast-check configured (property tests)
  - [ ] Playwright configured (e2e)
- [ ] Add npm scripts:
  - [ ] `test`
  - [ ] `test:watch`
  - [ ] `test:e2e`
  - [ ] `build`
  - [ ] `dev`
- [ ] Minimal App renders “FLL Tournament Planner”
- [ ] Unit smoke test: App header renders
- [ ] Playwright smoke test: page loads and finds header text

---

## 1) Domain Model + Utilities

### 1.1 Domain types
- [ ] Create `src/domain/` and export barrel `src/domain/index.ts`
- [ ] Define core types (aligning with spec):
  - [ ] `TournamentSetup`
  - [ ] `Slot`
  - [ ] `Assignment`
  - [ ] Enums: `Track`, `AssignmentType`
- [ ] Define breaks type:
  - [ ] `BreakInterval { start, end }`
- [ ] Define schedule result types:
  - [ ] `ValidSchedule { slots, assignments, warnings }`
  - [ ] `ScheduleFailure { errors, suggestions }`

### 1.2 Errors + suggestions model
- [ ] Define validation error model:
  - [ ] `ValidationError { code, message, path }`
- [ ] Define feasibility error codes (from spec):
  - [ ] `INSUFFICIENT_ROBOT_CAPACITY`
  - [ ] `INSUFFICIENT_PRESENTATION_CAPACITY`
  - [ ] `NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS`
  - [ ] `UNSATISFIABLE_OVERLAP_CONSTRAINTS`
- [ ] Define input validation error codes (from spec):
  - [ ] teams <= 1
  - [ ] tables/rooms < 1
  - [ ] start >= end
  - [ ] breaks invalid (start>=end, outside window, overlaps)
  - [ ] min gap < 15
- [ ] Define suggestion actions:
  - [ ] Increase tables
  - [ ] Increase rooms
  - [ ] Extend robot end time
  - [ ] Extend presentation end time
  - [ ] Reduce min gap (only if > 15)
  - [ ] Apply suggested breaks (requires acceptance)

### 1.3 Time representation + helpers (choose one consistently)
- [ ] Decide: store times as epoch ms or ISO strings (document it)
- [ ] Implement `src/domain/time/*` helpers:
  - [ ] `addMinutes`
  - [ ] `diffMinutes`
  - [ ] `overlaps(intervalA, intervalB)`
  - [ ] `withinWindow(time, start, end)`
  - [ ] parsing/format helpers for `datetime-local`
- [ ] Unit tests for time helpers (edge cases around boundaries)

---

## 2) Setup Validation (TDD)

- [ ] Implement `validateSetup(setup)` returning `{ok:true}` or `{ok:false, errors:[...]}`

### 2.1 Required fields + numeric constraints
- [ ] Reject `numberOfTeams <= 1`
- [ ] Reject `robotTablesCount < 1`
- [ ] Reject `presentationRoomsCount < 1`
- [ ] Reject `minGapMinutes < 15`

### 2.2 Window constraints
- [ ] Robot: reject `robotStartTime >= robotEndTime`
- [ ] Presentation: reject `presentationStartTime >= presentationEndTime`

### 2.3 Break validation (per track)
- [ ] Reject break with `start >= end`
- [ ] Reject break outside window (start < window start OR end > window end)
- [ ] Reject overlapping breaks within the same track
- [ ] Allow adjacent breaks that touch (end == start) (decide and test)
- [ ] Unit tests: each validation scenario with clear `path`s

### 2.4 Wire validation into UI (temporary)
- [ ] App calls `validateSetup` on a hard-coded setup and renders “Setup OK” or first error code

---

## 3) Slot Generation (TDD)

### 3.1 Presentation slots (30 minutes)
- [ ] Implement `generatePresentationSlots(setup)`:
  - [ ] Create sequential 30-minute slots within window
  - [ ] Exclude any slot intersecting a break interval
  - [ ] Include `roomIds = [1..roomsCount]` per slot
  - [ ] Deterministic slot IDs (stable for tests)
- [ ] Unit tests:
  - [ ] correct slot count with no breaks
  - [ ] excluded slots that intersect breaks
  - [ ] all slots within window
  - [ ] roomIds correct

### 3.2 Robot slots (5 minutes) + A/B table alternation
- [ ] Implement `generateRobotSlots(setup)`:
  - [ ] Create sequential 5-minute slots within window
  - [ ] Exclude any slot intersecting a break interval
  - [ ] Determine active tables each slot by alternation:
    - [ ] Group A: odd tables
    - [ ] Group B: even tables
    - [ ] Slot 1 uses A, slot 2 uses B, slot 3 uses A...
  - [ ] Decide behavior for empty group (e.g., T=1 gives groupB empty):
    - [ ] Prefer filtering out empty-table slots (document + test)
  - [ ] Deterministic slot IDs
- [ ] Unit tests:
  - [ ] A/B alternation correct for T=1,2,3,4,6
  - [ ] breaks exclusion correct
  - [ ] tableIds only include active group for that slot

### 3.3 Wire into UI (temporary)
- [ ] App displays counts: robot slots, presentation slots, robot capacity (sum of tableIds)

---

## 4) Capacity + Feasibility Checks (TDD)

- [ ] Implement `capacityCheck(setup, robotSlots, presentationSlots)`:
  - [ ] robot capacity = sum(slot.tableIds.length)
  - [ ] presentation capacity = presentationSlots.length * roomsCount
  - [ ] need robot = 3 * N
  - [ ] need presentation = 1 * N
- [ ] Return `{ok:true}` or `{ok:false, errors:[...], suggestions:[...]}`

### 4.1 Suggestions
- [ ] If insufficient robot capacity:
  - [ ] Suggest increase tables and/or extend robot end time
- [ ] If insufficient presentation capacity:
  - [ ] Suggest increase rooms and/or extend presentation end time
- [ ] If `minGapMinutes > 15`, optionally suggest reducing (never below 15)

### 4.2 Tests
- [ ] Boundary cases (exactly enough)
- [ ] Robot insufficient
- [ ] Presentation insufficient
- [ ] Both insufficient
- [ ] Suggestions appear correctly

### 4.3 Wire into UI (temporary)
- [ ] App shows “Capacity OK” or lists feasibility errors

---

## 5) Schedule Validator (Manual mode foundation) (TDD)

- [ ] Implement `validateSchedule(setup, slots, assignments)` returning `conflicts[]`

### 5.1 Conflict types
- [ ] Team overlap (any overlap across team events)
- [ ] Min gap violations across any two consecutive team events
- [ ] Resource double-booking:
  - [ ] Same slot + same table used twice
  - [ ] Same slot + same room used twice
- [ ] Invalid robot resource usage:
  - [ ] robot assignment uses tableId not in that slot.tableIds
- [ ] Assignment outside window or inside break (if possible from editing)

### 5.2 Message formatting (human readable)
- [ ] Example overlap message: “Team 7 presentation overlaps robot match at 10:30”
- [ ] Example gap message: “Team 4 gap between events is 10 minutes; minimum is 15”

### 5.3 Tests
- [ ] Each conflict type isolated
- [ ] Multiple conflicts returned
- [ ] No conflicts for a known valid schedule fixture

### 5.4 Wire into UI (temporary)
- [ ] App renders “Conflicts: X” for a hard-coded invalid example

---

## 6) Scheduling Engine v0 → v1 (TDD)

### 6.1 Engine output contract
- [ ] Implement `generateSchedule(setup)` that returns:
  - [ ] `ValidSchedule` (slots + assignments + warnings)
  - [ ] OR `ScheduleFailure` (errors + suggestions)
- [ ] Ensure deterministic behavior (stable ordering)

### 6.2 Assign presentations first (simple first-fit)
- [ ] Implement `assignPresentations(setup, presentationSlots)`:
  - [ ] Teams 1..N
  - [ ] Earliest available slot/room first-fit
  - [ ] No room double-booking in same slot
- [ ] Tests:
  - [ ] N teams assigned exactly once
  - [ ] deterministic mapping
  - [ ] respects capacity (assume checked earlier)

### 6.3 Assign robots (3 matches per team)
- [ ] Implement `assignRobotMatches(setup, robotSlots)`:
  - [ ] Build ordered list of “cells” = (slotId, tableId)
  - [ ] Allocate matches in round-robin:
    - [ ] For sequence 1..3, for team 1..N, pick next available cell
  - [ ] No table double-booking
  - [ ] Sequence preserved (1..3)
- [ ] Tests:
  - [ ] each team gets exactly 3 robot matches
  - [ ] no double-booking
  - [ ] assigned table is valid for that slot
  - [ ] deterministic output

### 6.4 Enforce hard constraints (v1 core)
- [ ] Add per-team calendar checks during assignment:
  - [ ] no overlaps across tracks
  - [ ] min gap across tracks and within track
- [ ] If placement fails:
  - [ ] return structured failure code:
    - [ ] `NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS` or `UNSATISFIABLE_OVERLAP_CONSTRAINTS`
  - [ ] include actionable suggestions
- [ ] Tests:
  - [ ] case where naive would violate gap but alternative placement exists
  - [ ] case where gap makes schedule impossible → failure code
  - [ ] success schedules have `validateSchedule` = no conflicts

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

- [ ] Add fast-check property tests that generate random setups:
  - [ ] teams 2..40
  - [ ] minGap 15..45
  - [ ] windows sometimes tight to induce failure
  - [ ] random non-overlapping breaks within windows
- [ ] For successful schedules assert invariants:
  - [ ] exactly N presentations
  - [ ] exactly 3N robot matches
  - [ ] `validateSchedule` returns no conflicts
  - [ ] assignments reference valid slot/resource
- [ ] For failures assert:
  - [ ] structured error codes only
  - [ ] suggestions present when applicable
- [ ] Ensure property tests are part of default `npm test` (or a strong CI script)

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
- [ ] On success:
  - [ ] show “Valid schedule generated”
  - [ ] show counts and warnings (if any)
- [ ] On failure:
  - [ ] show error list (code + human message)
  - [ ] show suggestions list (text)
  - [ ] add “apply suggestion” buttons (may be stub at first)

### 9.2 Team-centric table (primary)
- [ ] Rows: teams 1..N
- [ ] Columns:
  - [ ] Presentation time + room
  - [ ] Robot match 1 time + table
  - [ ] Robot match 2 time + table
  - [ ] Robot match 3 time + table
- [ ] Sorting stable by teamId
- [ ] Nice time formatting

### 9.3 Track grids (secondary)
- [ ] Tabs: Teams / Robot track / Presentation track
- [ ] Robot grid:
  - [ ] rows = robot slots
  - [ ] columns = active tables for that slot
  - [ ] cells show team or empty
- [ ] Presentation grid:
  - [ ] rows = presentation slots
  - [ ] columns = rooms
  - [ ] cells show team or empty

### 9.4 Tests
- [ ] Render test for team table from fixture schedule
- [ ] Render test for robot/presentation grids from fixture schedule

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