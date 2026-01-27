import { describe, expect, it } from "vitest";
import { createLocalStorageSetupRepository } from "./setupRepository";
import type { TournamentSetup } from "../domain";

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } as Storage;
};

const sampleSetup: TournamentSetup = {
  teams: [{ id: 1, name: "Team 1" }],
  robotTablesCount: 2,
  robotStartMs: 1,
  robotEndMs: 2,
  robotBreaks: [],
  presentationRoomsCount: 1,
  presentationStartMs: 3,
  presentationEndMs: 4,
  presentationBreaks: [],
  minGapMinutes: 15,
  suggestBreaks: false,
  suggestResources: false,
};

describe("setupRepository", () => {
  it("saves, lists, and loads setups", () => {
    const storage = createMemoryStorage();
    const repo = createLocalStorageSetupRepository(storage);

    expect(repo.list()).toEqual([]);

    const id = repo.save(sampleSetup, "Evening qualifier");
    const list = repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].name).toBe("Evening qualifier");
    expect(repo.load(id)).toEqual(sampleSetup);
  });

  it("uses a default name when none is provided", () => {
    const storage = createMemoryStorage();
    const repo = createLocalStorageSetupRepository(storage);

    repo.save(sampleSetup, "  ");
    const list = repo.list();
    expect(list[0].name).toBe("Untitled setup");
  });

  it("removes setups and clears last-opened when deleted", () => {
    const storage = createMemoryStorage();
    const repo = createLocalStorageSetupRepository(storage);

    const id = repo.save(sampleSetup, "Morning qualifier");
    repo.setLastOpened(id);
    expect(repo.getLastOpened()).toBe(id);

    repo.remove(id);
    expect(repo.list()).toEqual([]);
    expect(repo.getLastOpened()).toBeNull();
  });
});
