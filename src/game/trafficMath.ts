import { PATHS, RUSH_HOUR_SPAWN_INTERVALS_MS, VEHICLE_HEIGHT, VEHICLE_WIDTH } from "./config";
import type { Approach, Vec2, Vehicle } from "./types";

export function isVerticalApproach(approach: Approach): boolean {
  return approach === "NORTH" || approach === "SOUTH";
}

export function vehiclePosition(vehicle: Pick<Vehicle, "approach" | "progress">): Vec2 {
  const path = PATHS[vehicle.approach];
  return {
    x: path.start.x + path.direction.x * vehicle.progress,
    y: path.start.y + path.direction.y * vehicle.progress,
  };
}

export function vehicleRotation(approach: Approach): number {
  switch (approach) {
    case "NORTH":
      return Math.PI;
    case "SOUTH":
      return 0;
    case "WEST":
      return Math.PI / 2;
    case "EAST":
      return -Math.PI / 2;
  }
}

export function isInsideIntersection(vehicle: Pick<Vehicle, "approach" | "progress">): boolean {
  const path = PATHS[vehicle.approach];
  return vehicle.progress >= path.intersectionStart && vehicle.progress <= path.intersectionEnd;
}

export function vehiclesCollide(
  first: Pick<Vehicle, "approach" | "progress" | "state">,
  second: Pick<Vehicle, "approach" | "progress" | "state">,
): boolean {
  if (first.state === "CRASHED" || second.state === "CRASHED") {
    return false;
  }
  if (isVerticalApproach(first.approach) === isVerticalApproach(second.approach)) {
    return false;
  }
  if (!isInsideIntersection(first) || !isInsideIntersection(second)) {
    return false;
  }

  const firstPosition = vehiclePosition(first);
  const secondPosition = vehiclePosition(second);
  const combinedHalfWidth = (VEHICLE_WIDTH + VEHICLE_HEIGHT) / 2;
  return (
    Math.abs(firstPosition.x - secondPosition.x) < combinedHalfWidth &&
    Math.abs(firstPosition.y - secondPosition.y) < combinedHalfWidth
  );
}

export function scoreForCombo(combo: number): number {
  const safeCombo = Math.max(1, Math.floor(combo));
  return 100 + Math.min(safeCombo - 1, 20) * 10;
}

export function rushHourSpawnIntervalMs(wave: number): number {
  const waveIndex = Math.min(RUSH_HOUR_SPAWN_INTERVALS_MS.length - 1, Math.max(0, wave - 1));
  return RUSH_HOUR_SPAWN_INTERVALS_MS[waveIndex] ?? RUSH_HOUR_SPAWN_INTERVALS_MS[0];
}

export function spawnIntervalMs(elapsedMs: number): number {
  if (elapsedMs < 15_000) return 2_100;
  if (elapsedMs < 30_000) return 1_750;
  if (elapsedMs < 45_000) return 1_450;
  return 1_150;
}
