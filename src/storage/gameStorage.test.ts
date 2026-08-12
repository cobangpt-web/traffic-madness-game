import { describe, expect, it } from "vitest";
import { GameStorage, type StorageLike } from "./gameStorage";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  inject(value: string): void {
    this.values.set("traffic-madness:v1", value);
  }
}

describe("GameStorage", () => {
  it("stores only a new personal best", () => {
    const memory = new MemoryStorage();
    const storage = new GameStorage(memory);
    expect(storage.saveBest("2026-08-12", 1_200)).toBe(true);
    expect(storage.saveBest("2026-08-12", 900)).toBe(false);
    expect(storage.loadBest("2026-08-12")).toBe(1_200);
  });

  it("keeps stage best scores separate", () => {
    const memory = new MemoryStorage();
    const storage = new GameStorage(memory);
    expect(storage.saveBest("2026-08-12", 1_200, 1)).toBe(true);
    expect(storage.saveBest("2026-08-12", 900, 2)).toBe(true);
    expect(storage.loadBest("2026-08-12", 1)).toBe(1_200);
    expect(storage.loadBest("2026-08-12", 2)).toBe(900);
  });

  it("recovers from malformed and untrusted data", () => {
    const memory = new MemoryStorage();
    const storage = new GameStorage(memory);
    memory.inject("not-json");
    expect(storage.loadBest("2026-08-12")).toBe(0);
    memory.inject(JSON.stringify({ version: 1, bestByDay: { "2026-08-12": "huge" } }));
    expect(storage.loadBest("2026-08-12")).toBe(0);
  });

  it("persists mute and tutorial preferences", () => {
    const memory = new MemoryStorage();
    const storage = new GameStorage(memory);
    storage.setMuted(true);
    storage.markTutorialSeen();
    expect(storage.isMuted()).toBe(true);
    expect(storage.hasSeenTutorial()).toBe(true);
  });
});
