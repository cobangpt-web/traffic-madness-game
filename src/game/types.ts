export const APPROACHES = ["NORTH", "SOUTH", "EAST", "WEST"] as const;
export type Approach = (typeof APPROACHES)[number];

export const STAGES = [1, 2] as const;
export type StageNumber = (typeof STAGES)[number];

export const CAR_COLORS = ["RED", "BLUE", "GREEN", "YELLOW", "BLACK"] as const;
export type CarColor = (typeof CAR_COLORS)[number];

export type SignalPhase = "NORTH_SOUTH" | "EAST_WEST";
export type SignalMode = "GREEN" | "AMBER" | "ALL_RED";
export type GameStatus = "READY" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "RESULT";
export type VehicleState = "APPROACHING" | "WAITING" | "CROSSING" | "EXITING" | "CRASHED";
export type FinishReason = "TIME" | "CRASH_LIMIT";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Vehicle {
  readonly id: string;
  readonly approach: Approach;
  readonly color: CarColor;
  readonly emergency?: boolean;
  progress: number;
  readonly speed: number;
  state: VehicleState;
  crashAgeMs: number;
}

export interface SignalSnapshot {
  readonly activePhase: SignalPhase;
  readonly targetPhase: SignalPhase;
  readonly mode: SignalMode;
  readonly transitionRemainingMs: number;
}

export interface GameSnapshot {
  readonly stage: StageNumber;
  readonly status: GameStatus;
  readonly countdownMs: number;
  readonly remainingMs: number;
  readonly elapsedMs: number;
  readonly score: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly collisionCount: number;
  readonly passedVehicles: number;
  readonly emergencyBonuses: number;
  readonly gridlockLevel: number;
  readonly spilloverApproaches: readonly Approach[];
  readonly brakingVehicleIds: readonly string[];
  readonly rushHourWave: number;
  readonly rushHourWaveRemainingMs: number;
  readonly rushHourWavesCleared: number;
  readonly dailySeed: string;
  readonly signal: SignalSnapshot;
  readonly vehicles: readonly Readonly<Vehicle>[];
}

export interface RunResult {
  readonly stage: StageNumber;
  readonly dailySeed: string;
  readonly score: number;
  readonly maxCombo: number;
  readonly passedVehicles: number;
  readonly collisions: number;
  readonly emergencyBonuses: number;
  readonly rushHourWavesCleared: number;
  readonly reason: FinishReason;
}

export type GameEvent =
  | { readonly type: "RUN_STARTED"; readonly stage: StageNumber }
  | { readonly type: "SIGNAL_REQUESTED"; readonly phase: SignalPhase }
  | { readonly type: "SIGNAL_CHANGED"; readonly phase: SignalPhase }
  | { readonly type: "EMERGENCY_SPAWNED"; readonly vehicleId: string; readonly approach: Approach; readonly elapsedMs: number }
  | { readonly type: "VEHICLE_PASSED"; readonly points: number; readonly combo: number; readonly color: CarColor; readonly emergency: boolean }
  | { readonly type: "COLLISION"; readonly collisionCount: number }
  | { readonly type: "SUDDEN_BRAKE_STARTED"; readonly approaches: readonly Approach[] }
  | { readonly type: "RUSH_HOUR_WAVE_STARTED"; readonly wave: number; readonly totalWaves: number }
  | { readonly type: "RUSH_HOUR_WAVE_CLEARED"; readonly wave: number; readonly points: number }
  | { readonly type: "GRIDLOCK"; readonly approach: Approach }
  | { readonly type: "RUN_FINISHED"; readonly result: RunResult };

export interface PathDefinition {
  readonly start: Vec2;
  readonly direction: Vec2;
  readonly stopProgress: number;
  readonly intersectionStart: number;
  readonly intersectionEnd: number;
  readonly endProgress: number;
}
