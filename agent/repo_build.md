Create a repo scaffold specifically for a frontend-only webapp:
“FIRST LEGO League Tournament Planner (v1)”.

Tech stack (required):
- Vite + React + TypeScript
- Unit tests: Vitest + Testing Library + jest-dom + user-event (jsdom)
- Property tests: fast-check (runs in Vitest)
- E2E tests: Playwright (@playwright/test)

Architecture constraints (project-specific):
1) src/domain and src/engine MUST be pure (no React, no browser APIs, no localStorage).
2) Determinism conventions MUST be documented and used:
   - Internally represent times as epoch milliseconds (number).
   - Slot IDs MUST be deterministic: `${track}:${startMs}` (or `${track}:${startMs}:${index}`).
   - Assignment ordering MUST be stable (sort by teamId, type, sequence).
3) Create the folder structure below exactly (even if some folders are initially empty).

Required folder structure:
- src/domain
- src/domain/time
- src/engine
- src/engine/slots
- src/engine/assign
- src/engine/feasibility
- src/engine/repair
- src/engine/editing
- src/engine/__tests__
- src/engine/__fixtures__
- src/engine/__property__
- src/ui
- src/ui/setup
- src/ui/schedule
- src/state
- src/storage
- src/dnd
- tests
- tests/helpers

Repo requirements:
A) Scaffold the app:
- Use Vite + React + TS.
- Ensure npm install + dev server works.

B) Add npm scripts to package.json:
- dev, build, preview
- test: `vitest run`
- test:watch: `vitest`
- test:e2e: `playwright test`

C) Add configs:
1) vitest.config.ts:
- environment: "jsdom"
- include setup file src/setupTests.ts
2) src/setupTests.ts:
- import "@testing-library/jest-dom"
3) playwright.config.ts:
- configure a standard Playwright setup that runs against the Vite dev server (or uses preview)
- keep it simple and stable

D) Implement minimal UI that is already wired to the engine (no orphan code):
1) src/App.tsx:
- Render a visible header text: "FLL Tournament Planner"
- Render a small "Engine status" section that calls a placeholder engine function and displays "Engine OK"
2) src/main.tsx:
- Render <App />

E) Create a placeholder engine API (wired; no real scheduling yet):
- src/engine/index.ts exports:
  - generateSchedule
  - validateSetup
  - validateSchedule
- src/engine/validateSetup.ts:
  - export function validateSetup(...) that returns { ok: true } for now
- src/engine/generateSchedule.ts:
  - export function generateSchedule(...) that returns a typed stub schedule result, e.g. { ok: true, slots: [], assignments: [], warnings: [] }
- src/engine/validateSchedule.ts:
  - export function validateSchedule(...) that returns [] for now
- src/domain/types.ts and src/domain/errors.ts:
  - define minimal types needed so the stub engine return is correctly typed (TournamentSetup, Slot, Assignment, basic enums)
- src/domain/index.ts and src/engine/index.ts must be clean barrel exports

F) Tests (must pass):
1) Unit test (Vitest + Testing Library):
- asserts the App renders the header "FLL Tournament Planner"
- asserts it renders "Engine OK" (meaning App calls the engine)
2) Engine unit test:
- validateSetup() returns { ok: true }
3) Playwright smoke test:
- loads the app and finds the header text "FLL Tournament Planner"

Documentation:
- Create README.md that includes:
  - how to run dev/build
  - how to run unit tests and e2e tests
  - a short architecture note: domain/engine are pure; determinism rules; no randomization in v1
- Create todo.md (can be a placeholder checklist)

Hard constraints:
- Do NOT implement real scheduling logic yet.
- Do NOT leave unused/orphan code: all stubs must be imported and used by the App.
- Ensure `npm test` and `npm run test:e2e` both pass.
- Output the complete file tree and the contents of all new/modified files.