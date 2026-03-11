Step 22 goals:
Implement setup persistence (v1 requirement):
- repository abstraction: list(), save(setup), load(id), remove(id), setLastOpened(id), getLastOpened()
- use LocalStorage
- UI:
  - “Save setup” (name optional)
  - “Load setup” dropdown/list
  - “Delete setup”
  - on app start, load last-opened if present

Tests:
- repository unit tests with mocked localStorage
- UI smoke test: save then reload retains values

Wire it in:
- Settings panel includes save/load actions.

Done