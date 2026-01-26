# FIRST LEGO League Tournament Planner (v1)

Frontend-only webapp scaffold built with Vite + React + TypeScript.

## Development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`

## Tests

- Unit tests: `npm test`
- Watch mode: `npm run test:watch`
- E2E tests: `npm run test:e2e`

## Architecture notes

- `src/domain` and `src/engine` are pure. No React, browser APIs, or storage access.
- Determinism rules:
  - All times are represented as epoch milliseconds (number).
  - Slot IDs are deterministic: `${track}:${startMs}` or `${track}:${startMs}:${index}`.
  - Assignment ordering is stable: sort by `teamId`, then `type`, then `sequence`.
- No randomization is used in v1.
