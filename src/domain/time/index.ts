import type { EpochMs, TimeWindow } from "../types";

const MINUTE_MS = 60_000;

export function addMinutes(valueMs: EpochMs, minutes: number): EpochMs {
  return valueMs + minutes * MINUTE_MS;
}

export function diffMinutes(startMs: EpochMs, endMs: EpochMs): number {
  return (endMs - startMs) / MINUTE_MS;
}

export function isValidWindow(window: TimeWindow): boolean {
  return window.startMs < window.endMs;
}

export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function withinWindow(target: TimeWindow, window: TimeWindow): boolean {
  return target.startMs >= window.startMs && target.endMs <= window.endMs;
}

export function parseLocalDateTime(value: string): EpochMs | null {
  if (!value) return null;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? "0");

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date.getTime();
}

export function formatLocalDateTime(valueMs: EpochMs): string {
  const date = new Date(valueMs);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
