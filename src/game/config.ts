import type { Approach, PathDefinition } from "./types";

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
export const RUN_DURATION_MS = 60_000;
export const COUNTDOWN_MS = 3_000;
export const AMBER_DURATION_MS = 350;
export const ALL_RED_DURATION_MS = 250;
export const FIXED_STEP_MS = 1_000 / 60;
export const VEHICLE_GAP = 82;
export const VEHICLE_WIDTH = 38;
export const VEHICLE_HEIGHT = 70;
export const COLLISION_LIMIT = 3;
export const GRIDLOCK_QUEUE_SIZE = 7;
export const SPILLOVER_DURATION_MS = 5_000;
export const SUDDEN_BRAKE_DURATION_MS = 2_800;
export const SPILLOVER_RECOVERY_SPEED_FACTOR = 0.35;
export const EMERGENCY_MIN_INTERVAL_MS = 18_000;
export const MAX_EMERGENCIES_PER_RUN = 3;
export const RUSH_HOUR_WAVE_DURATION_MS = 10_000;
export const RUSH_HOUR_TOTAL_WAVES = Math.ceil(RUN_DURATION_MS / RUSH_HOUR_WAVE_DURATION_MS);
export const RUSH_HOUR_WAVE_CLEAR_POINTS = 300;
export const RUSH_HOUR_SPAWN_INTERVALS_MS = [1_850, 1_550, 1_300, 1_050, 820, 650] as const;

export const PATHS: Readonly<Record<Approach, PathDefinition>> = {
  NORTH: {
    start: { x: 590, y: -90 },
    direction: { x: 0, y: 1 },
    stopProgress: 315,
    intersectionStart: 325,
    intersectionEnd: 615,
    endProgress: 900,
  },
  SOUTH: {
    start: { x: 690, y: 810 },
    direction: { x: 0, y: -1 },
    stopProgress: 275,
    intersectionStart: 285,
    intersectionEnd: 575,
    endProgress: 900,
  },
  WEST: {
    start: { x: -90, y: 350 },
    direction: { x: 1, y: 0 },
    stopProgress: 565,
    intersectionStart: 575,
    intersectionEnd: 875,
    endProgress: 1460,
  },
  EAST: {
    start: { x: 1370, y: 430 },
    direction: { x: -1, y: 0 },
    stopProgress: 565,
    intersectionStart: 575,
    intersectionEnd: 875,
    endProgress: 1460,
  },
};
