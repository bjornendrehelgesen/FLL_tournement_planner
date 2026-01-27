You are implementing the FIRST LEGO League Tournament Planner (v1) as a frontend-only webapp.

Step 1 goals:
- Create a Vite + React + TypeScript project.
- Add Vitest and configure it for TS unit tests.
- Add fast-check for property-based tests (configure for Vitest).
- Add Playwright (basic config) with a single smoke test placeholder that loads the app.
- Add npm scripts: test, test:watch, test:property (can be same as test), test:e2e, lint (optional).
- Ensure “npm test” passes.

Constraints:
- No scheduling logic yet.
- Keep file structure ready for domain/engine/ui separation.

Deliverables:
- Working project scaffold.
- Minimal App component that renders a header text “FLL Tournament Planner”.
- One passing unit test (e.g., App renders).
- One passing Playwright test that loads the page and finds the header.

Wire it in:
- Ensure App is used by main.tsx and tests actually run in CI-like mode.

Done