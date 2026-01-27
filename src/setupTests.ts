import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

const ensureLocalStorage = () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const currentValue =
    descriptor && "value" in descriptor ? descriptor.value : undefined;
  if (!currentValue || typeof currentValue.getItem !== "function") {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
};

ensureLocalStorage();

afterEach(() => {
  cleanup();
});
