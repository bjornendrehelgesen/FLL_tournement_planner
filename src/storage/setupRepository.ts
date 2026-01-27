import type { TournamentSetup } from "../domain";

const SETUPS_KEY = "fll-tournament-planner:setups:v1";
const LAST_OPENED_KEY = "fll-tournament-planner:last-opened:v1";

export type SetupSummary = {
  id: string;
  name: string;
  savedAt: number;
};

export type StoredSetup = SetupSummary & {
  setup: TournamentSetup;
};

export type SetupRepository = {
  list: () => SetupSummary[];
  save: (setup: TournamentSetup, name?: string) => string;
  load: (id: string) => TournamentSetup | null;
  remove: (id: string) => void;
  setLastOpened: (id: string) => void;
  getLastOpened: () => string | null;
};

const DEFAULT_NAME = "Untitled setup";

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `setup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readEntries = (storage: Storage): StoredSetup[] => {
  const raw = storage.getItem(SETUPS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredSetup[];
  } catch {
    return [];
  }
};

const writeEntries = (storage: Storage, entries: StoredSetup[]) => {
  storage.setItem(SETUPS_KEY, JSON.stringify(entries));
};

export const createLocalStorageSetupRepository = (
  storage: Storage = window.localStorage
): SetupRepository => ({
  list: () => {
    const entries = readEntries(storage);
    return entries
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(({ id, name, savedAt }) => ({ id, name, savedAt }));
  },
  save: (setup, name) => {
    const entries = readEntries(storage);
    const id = createId();
    const resolvedName =
      name && name.trim().length > 0 ? name.trim() : DEFAULT_NAME;
    const nextEntry: StoredSetup = {
      id,
      name: resolvedName,
      savedAt: Date.now(),
      setup,
    };
    writeEntries(storage, [...entries, nextEntry]);
    return id;
  },
  load: (id) => {
    const entries = readEntries(storage);
    const found = entries.find((entry) => entry.id === id);
    return found?.setup ?? null;
  },
  remove: (id) => {
    const entries = readEntries(storage);
    const nextEntries = entries.filter((entry) => entry.id !== id);
    if (nextEntries.length !== entries.length) {
      writeEntries(storage, nextEntries);
    }
    if (storage.getItem(LAST_OPENED_KEY) === id) {
      storage.removeItem(LAST_OPENED_KEY);
    }
  },
  setLastOpened: (id) => {
    storage.setItem(LAST_OPENED_KEY, id);
  },
  getLastOpened: () => {
    return storage.getItem(LAST_OPENED_KEY);
  },
});
