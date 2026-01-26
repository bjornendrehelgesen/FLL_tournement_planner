# FIRST LEGO League Tournament Planner — Developer Specification (v1)

## 1) Product overview

### Goal
A webapp that generates and displays a tournament schedule for:
- **Robot matches**: 5 minutes each  
- **Presentations**: 30 minutes each  

Such that **every team** receives:
- **Exactly 3 robot matches**
- **Exactly 1 presentation**

Hard constraints:
- A team’s events **must never overlap** (robot vs presentation and any robot vs robot etc.).
- There must be a configurable **minimum gap between any two events for the same team**, with:
  - user can enter any value **>= 15 minutes**
  - validation must reject values < 15

Workflow:
1) User enters tournament parameters (quick start + settings).
2) App generates a **draft schedule**.
3) User can **drag-and-drop** to adjust.
4) App supports two editing modes:
   - **Auto-reshuffle**: moving one item triggers automatic reassignments to keep schedule valid.
   - **Manual**: user can rearrange freely; app warns and provides a **Validate** check.

Breaks:
- Supports **manual breaks**
- Can **recommend breaks** to help alignment/feasibility
- Robot and presentation breaks are **separate** and can differ.

Out of scope (v1):
- Assigning referees/judges
- Export to PDF/Spreadsheet (v2)
- Importing team lists / team names (v2)

---

## 2) Inputs (Version 1)

### Quick start (minimum required)
- `number_of_teams` (integer > 1)

### Settings menu (configurable)
Robot track:
- `robot_tables_count` (integer >= 1)
- `robot_start_time` (datetime)
- `robot_end_time` (datetime)
- `robot_breaks` (list of intervals `{start, end}`)

Presentation track:
- `presentation_rooms_count` (integer >= 1)
- `presentation_start_time` (datetime)
- `presentation_end_time` (datetime)
- `presentation_breaks` (list of intervals `{start, end}`)

Shared:
- `min_gap_minutes` (integer >= 15)

Recommendation toggles:
- `suggest_breaks` (boolean)
- `suggest_resources` (boolean) — recommend tables/rooms based on feasibility.

Assumption (v1 teams):
- Teams identified by integer IDs `1..N`.

---

## 3) Scheduling rules and constraints

### 3.1 Slot durations
- Robot match slot = **5 minutes**
- Presentation slot = **30 minutes**
- Break intervals remove time from slot generation (no events scheduled during breaks).

### 3.2 Per-team requirements
Each team must be assigned:
- 3 robot matches
- 1 presentation

And must satisfy:
- No overlap between any of that team’s events
- For any two events for the same team, start/end times must be separated by at least `min_gap_minutes`.

### 3.3 Robot tables concurrency pattern (setup-time alternation)
Robot tables alternate in odd/even groups to allow setup time.

Let `T = robot_tables_count`.
Define table groups:
- Group A: odd tables `{1,3,5,...}`
- Group B: even tables `{2,4,6,...}`

Rule:
- Robot slot 1 uses Group A simultaneously
- Robot slot 2 uses Group B simultaneously
- Robot slot 3 uses Group A, etc. (alternating A/B)
- If T is odd, Group A has one extra table; still alternate.

Examples:
- T=2: slot1 table1, slot2 table2, slot3 table1...
- T=4: slot1 tables 1&3, slot2 tables 2&4...
- T=6: slot1 tables 1&3&5, slot2 tables 2&4&6...

### 3.4 Presentations concurrency
- All presentation rooms run **at the same time** per slot.
- Presentation start/end and breaks can differ from robot start/end and breaks.

### 3.5 Breaks
- Robot breaks affect only robot slot generation.
- Presentation breaks affect only presentation slot generation.

Break recommendation behavior:
- If enabled, engine can suggest breaks (or buffer blocks) that improve feasibility/alignment.
- Suggested breaks must be explainable and require user acceptance to apply.

---

## 4) Scheduling engine

### 4.1 Output
The engine returns either:
- **Valid schedule**:
  - `slots` for robot and presentations
  - `assignments` for teams
  - `warnings` (optional)
- **Or failure**:
  - `errors` (structured)
  - `suggestions` (actions user could take)

### 4.2 Feasibility checks (must occur before finalizing)
Detect and report:
- Insufficient robot capacity for 3 matches/team within robot window
- Insufficient presentation capacity for 1 presentation/team within presentation window
- Gap / overlap constraints make combined schedule infeasible

Provide actionable guidance:
- Increase robot tables
- Increase presentation rooms
- Extend robot/presentation end times
- Increase/adjust breaks (recommendations)
- Reduce min gap (but never below 15)

### 4.3 Recommended algorithm approach (implementation guidance)
1) **Generate time slots**:
   - Robot: 5-minute slots excluding breaks; each slot includes active table group (A or B).
   - Presentation: 30-minute slots excluding breaks.

2) **Capacity check**:
   - Robot capacity = sum over robot slots of `active_tables_count(slot)`
   - Presentation capacity = `presentation_rooms_count * presentation_slots_count`

3) **Initial assignment**:
   - Assign presentations first (coarser slots).
   - Then assign robot matches (3 per team), spreading across slots/tables.

4) **Constraint enforcement and repair**:
   - Ensure no overlaps and min-gap per team across both tracks.
   - Use greedy + local swap/repair; fallback to limited backtracking if needed.
   - If unsatisfiable, return clear errors + suggestions.

Determinism:
- Same inputs produce same schedule unless a “randomize/seed” feature is added.

---

## 5) Editing (drag & drop)

### 5.1 Editable items
- Move a team’s **presentation** to another valid presentation slot/room.
- Move a team’s **robot match** to another valid robot slot/table (respecting slot’s active table group).

### 5.2 Modes
**Auto-reshuffle mode**
- If a drop target is occupied, system reassigns displaced team(s) to nearest valid open slot(s).
- Must maintain all constraints.
- If impossible, revert and show reason.

**Manual mode**
- User can create conflicts temporarily.
- Show warnings (banner + highlight conflicts).
- Provide a “Validate schedule” action to list:
  - overlaps
  - min-gap violations
  - invalid resource usage / double-booking

---

## 6) UI specification

### 6.1 Screens
A) **Quick start**
- Input: number of teams
- Optional recommended tables/rooms (if enabled)
- “Generate schedule”

B) **Settings menu/panel**
- Robot config: tables count, time window, breaks
- Presentation config: rooms count, time window, breaks
- Shared: min gap (>=15)
- Toggles: suggest breaks/resources
- Actions:
  - Regenerate schedule
  - Save setup / Load setup

C) **Schedule view**
Primary: **Team-centric table** (for teams to see their time quickly)
- Rows: Teams
- Columns:
  - Presentation time + room
  - Robot match 1 time + table
  - Robot match 2 time + table
  - Robot match 3 time + table

Secondary (recommended for planning / drag-drop):
- Robot track table:
  - Rows: time slots
  - Columns: active tables that slot (e.g., 1 & 3)
- Presentation track table:
  - Rows: time slots
  - Columns: rooms

### 6.2 Conflict display
- Manual mode highlights conflicts
- Conflict list panel includes human-readable items like:
  - “Team 7 presentation overlaps robot match at 10:30”
  - “Team 4 gap between events is 10 minutes; minimum is 15”

---

## 7) Data model

### 7.1 Entities

**TournamentSetup**
- `id` (UUID)
- `name` (string, optional)
- `numberOfTeams` (int)
- Robot:
  - `robotTablesCount` (int)
  - `robotStartTime` (datetime)
  - `robotEndTime` (datetime)
  - `robotBreaks` (list of `{start,end}`)
- Presentation:
  - `presentationRoomsCount` (int)
  - `presentationStartTime` (datetime)
  - `presentationEndTime` (datetime)
  - `presentationBreaks` (list of `{start,end}`)
- Shared:
  - `minGapMinutes` (int >= 15)
- `createdAt`, `updatedAt`

**Slot**
- `id` (UUID)
- `track`: `ROBOT` | `PRESENTATION`
- `start`, `end`
- `resources`:
  - Robot: `tableIds[]` (active group for that slot)
  - Presentation: `roomIds[]`

**Assignment**
- `teamId` (int)
- `type`: `ROBOT_MATCH` | `PRESENTATION`
- `slotId` (UUID)
- `resourceId` (tableId or roomId)
- `sequence` (1..3 for robot matches, null for presentation)

### 7.2 Persistence (v1 requirement: remember setups)
- Store setups in browser:
  - LocalStorage or IndexedDB
- Save:
  - list of setups
  - last-opened setup

---

## 8) Error handling

### 8.1 Input validation errors
- teams <= 1
- tables/rooms < 1
- start >= end
- breaks invalid (start>=end, outside window, overlaps)
- min gap < 15

### 8.2 Scheduling feasibility errors (structured)
- `INSUFFICIENT_ROBOT_CAPACITY` (need 3*N assignments, have X)
- `INSUFFICIENT_PRESENTATION_CAPACITY` (need N assignments, have X)
- `NO_VALID_ASSIGNMENT_WITH_GAP_CONSTRAINTS`
- `UNSATISFIABLE_OVERLAP_CONSTRAINTS`

### 8.3 UX for recovery
- Show errors at top + detailed explanation
- “Fix suggestions” list with one-click apply where reasonable:
  - increase tables/rooms (adjust settings)
  - extend end times
  - apply recommended break(s)
- Never silently change settings without user approval

---

## 9) Testing plan

### 9.1 Unit tests (engine)
- Slot generation excludes breaks correctly
- Robot A/B group alternation correct for T=1,2,3,4,6,8
- Capacity calculations correct
- Team constraints:
  - exactly 3 robot matches + 1 presentation per team
  - no overlaps per team
  - min gap enforced
- Failure cases:
  - insufficient robot capacity
  - insufficient presentation capacity
  - gap makes schedule impossible

### 9.2 Property-based tests (recommended)
Generate random setups and assert invariants:
- No team overlap
- Assignment counts correct
- Assignments within windows and not in breaks
- No table/room double-booked in same slot

### 9.3 Integration tests (UI)
- Setup → generate schedule → tables render
- Manual vs auto-reshuffle mode switching
- Drag-drop behavior:
  - auto keeps schedule valid
  - manual allows conflict; validator detects
- Save/load setup persistence

### 9.4 Performance tests
- Test realistic sizes (e.g., 60–120 teams)
- Ensure generation + drag-drop remain responsive

---

## 10) Definition of done (v1)
- User can configure teams, time windows, tables/rooms, min gap (>=15), and breaks per track.
- App generates a schedule meeting:
  - 3 robot matches + 1 presentation per team
  - no overlaps
  - min gap >= 15
  - robot table A/B alternation
- Schedule displayed in a clear team-centric table.
- Drag-and-drop editing works with:
  - auto-reshuffle mode
  - manual mode + validate collisions
- Setups can be saved and reloaded locally.