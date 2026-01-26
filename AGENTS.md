# Repository Guidelines

## Project Structure & Module Organization
- `agent/` holds planning documents for the FIRST LEGO League Tournament Planner, including `spec.md` (product spec) and `todo.md` (implementation checklist).
- `agent/promt*.md` files capture prompt drafts; keep the `promtNN.md` naming pattern when adding more.
- There is currently no application source tree (`src/`) or tests directory in this repository.

## Build, Test, and Development Commands
- No build/test tooling is wired up yet. When a codebase is introduced, add scripts to `package.json` (or a task runner) and document them here.
- Recommended future scripts (once applicable): `dev` (local server), `build` (production bundle), `test` (unit tests), `lint` (static checks).

## Coding Style & Naming Conventions
- Markdown: keep headings short and consistent; use kebab- or snake-case file names only if a pattern is established in that folder.
- Code style is not defined yet. When adding source code, introduce a formatter/linter (e.g., Prettier + ESLint) and note indentation and naming rules in this document.

## Testing Guidelines
- No test framework is configured yet.
- When tests are added, place unit tests alongside code (e.g., `src/**/__tests__`) or in a dedicated `tests/` directory, and document the convention here.

## Commit & Pull Request Guidelines
- Git history currently contains only an “Initial commit,” so no message convention is established yet.
- Suggested practice: use short, imperative commit subjects (e.g., "Add schedule validation") and include a brief PR description with scope and testing notes.

## Architecture Notes
- The product intent and constraints are defined in `agent/spec.md`. Keep new implementation work aligned with that document.
- Track milestone progress in `agent/todo.md` and update checklist items as they are completed.
