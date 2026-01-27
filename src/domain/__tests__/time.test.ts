import { describe, expect, it } from "vitest";
import {
  addMinutes,
  diffMinutes,
  formatLocalDateTime,
  isValidWindow,
  overlaps,
  parseLocalDateTime,
  withinWindow,
} from "../../domain";

describe("time helpers", () => {
  it("parses and formats datetime-local values", () => {
    const input = "2026-01-15T09:30";
    const parsed = parseLocalDateTime(input);
    expect(parsed).not.toBeNull();
    expect(formatLocalDateTime(parsed as number)).toBe(input);
  });

  it("returns null for invalid datetime-local values", () => {
    expect(parseLocalDateTime("")).toBeNull();
    expect(parseLocalDateTime("2026-13-40T25:90")).toBeNull();
    expect(parseLocalDateTime("2026-01-15 09:30")).toBeNull();
  });

  it("adds and diffs minutes using epoch ms", () => {
    const start = 0;
    const end = addMinutes(start, 30);
    expect(end).toBe(30 * 60 * 1000);
    expect(diffMinutes(start, end)).toBe(30);
  });

  it("detects window overlap using half-open intervals", () => {
    const a = { startMs: 0, endMs: 10 };
    const b = { startMs: 5, endMs: 15 };
    const c = { startMs: 10, endMs: 20 };
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false);
  });

  it("checks window containment and validity", () => {
    const window = { startMs: 0, endMs: 100 };
    const target = { startMs: 20, endMs: 80 };
    const outside = { startMs: 20, endMs: 120 };
    expect(withinWindow(target, window)).toBe(true);
    expect(withinWindow(outside, window)).toBe(false);
    expect(isValidWindow(window)).toBe(true);
    expect(isValidWindow({ startMs: 5, endMs: 5 })).toBe(false);
  });
});
