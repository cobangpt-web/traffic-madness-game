import type { StageNumber } from "../game/types";

const STORAGE_KEY = "traffic-madness:v1";
const MAX_SCORE = 1_000_000_000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredGameData {
  readonly version: 1;
  readonly bestByDay: Record<string, number>;
  readonly muted: boolean;
  readonly tutorialSeen: boolean;
}

const DEFAULT_DATA: StoredGameData = {
  version: 1,
  bestByDay: {},
  muted: false,
  tutorialSeen: false,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(MAX_SCORE, Math.max(0, Math.floor(value)));
}

function parseData(raw: string | null): StoredGameData {
  if (!raw) return { ...DEFAULT_DATA, bestByDay: {} };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainRecord(parsed) || parsed.version !== 1) {
      return { ...DEFAULT_DATA, bestByDay: {} };
    }

    const bestByDay: Record<string, number> = {};
    if (isPlainRecord(parsed.bestByDay)) {
      for (const [key, value] of Object.entries(parsed.bestByDay).slice(0, 400)) {
        if (!/^\d{4}-\d{2}-\d{2}(?::stage:[12])?$/.test(key)) continue;
        const score = sanitizeScore(value);
        if (score !== null) bestByDay[key] = score;
      }
    }

    return {
      version: 1,
      bestByDay,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
      tutorialSeen: typeof parsed.tutorialSeen === "boolean" ? parsed.tutorialSeen : false,
    };
  } catch {
    return { ...DEFAULT_DATA, bestByDay: {} };
  }
}

export class GameStorage {
  private healthy = true;

  constructor(private readonly storage: StorageLike) {}

  isHealthy(): boolean {
    return this.healthy;
  }

  loadBest(dateKey: string, stage: StageNumber = 1): number {
    return this.read().bestByDay[this.stageKey(dateKey, stage)] ?? 0;
  }

  saveBest(dateKey: string, score: number, stage: StageNumber = 1): boolean {
    const data = this.read();
    const safeScore = sanitizeScore(score) ?? 0;
    const key = this.stageKey(dateKey, stage);
    if (safeScore <= (data.bestByDay[key] ?? 0)) return false;
    data.bestByDay[key] = safeScore;
    this.write(data);
    return true;
  }

  isMuted(): boolean {
    return this.read().muted;
  }

  setMuted(muted: boolean): void {
    const data = this.read();
    this.write({ ...data, muted });
  }

  hasSeenTutorial(): boolean {
    return this.read().tutorialSeen;
  }

  markTutorialSeen(): void {
    const data = this.read();
    this.write({ ...data, tutorialSeen: true });
  }

  private read(): StoredGameData {
    try {
      return parseData(this.storage.getItem(STORAGE_KEY));
    } catch {
      this.healthy = false;
      return { ...DEFAULT_DATA, bestByDay: {} };
    }
  }

  private write(data: StoredGameData): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      this.healthy = false;
    }
  }

  private stageKey(dateKey: string, stage: StageNumber): string {
    return stage === 1 ? dateKey : `${dateKey}:stage:${stage}`;
  }
}
