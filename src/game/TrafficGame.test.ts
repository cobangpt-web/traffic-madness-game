import { describe, expect, it } from "vitest";
import { FIXED_STEP_MS, RUN_DURATION_MS } from "./config";
import { TrafficGame } from "./TrafficGame";

function advance(game: TrafficGame, durationMs: number, onStep?: (elapsedMs: number) => void): void {
  let elapsedMs = 0;
  while (elapsedMs < durationMs) {
    onStep?.(elapsedMs);
    game.step(FIXED_STEP_MS);
    elapsedMs += FIXED_STEP_MS;
  }
}

describe("TrafficGame", () => {
  it("moves from countdown into a playable run", () => {
    const game = new TrafficGame();
    game.start(10, "2026-08-12");
    expect(game.snapshot().status).toBe("COUNTDOWN");
    advance(game, 3_050);
    expect(game.snapshot().status).toBe("PLAYING");
    expect(game.drainEvents()).toContainEqual({ type: "RUN_STARTED", stage: 1 });
  });

  it("keeps stage one at baseline traffic and enables rush-hour waves in stage two", () => {
    const firstStage = new TrafficGame();
    firstStage.start(10, "2026-08-12", 1);
    advance(firstStage, 3_050 + 11_000);
    expect(firstStage.snapshot().stage).toBe(1);
    expect(firstStage.snapshot().rushHourWave).toBe(0);

    const secondStage = new TrafficGame();
    secondStage.start(10, "2026-08-12", 2);
    advance(secondStage, 3_050 + 9_000);
    expect(secondStage.snapshot().stage).toBe(2);
    expect(secondStage.snapshot().rushHourWave).toBe(1);
    expect(secondStage.drainEvents().some((event) => event.type === "RUSH_HOUR_WAVE_STARTED")).toBe(true);
  });

  it("raises the rush-hour wave every ten seconds", () => {
    const game = new TrafficGame();
    game.start(10, "2026-08-12", 2);
    advance(game, 3_050 + 10_100);
    expect(game.snapshot().rushHourWave).toBe(2);
    expect(game.snapshot().rushHourWavesCleared).toBe(1);
    expect(game.snapshot().score).toBeGreaterThanOrEqual(300);
  });

  it("clears all six rush-hour waves by the end of stage two", () => {
    const game = new TrafficGame();
    game.start(10, "2026-08-12", 2);
    advance(game, 3_050 + RUN_DURATION_MS + 100);
    expect(game.snapshot().rushHourWavesCleared).toBe(6);
    expect(game.currentResult()?.rushHourWavesCleared).toBe(6);
  });

  it("freezes the clock while paused", () => {
    const game = new TrafficGame();
    game.start(10, "2026-08-12");
    advance(game, 3_050);
    expect(game.pause()).toBe(true);
    const before = game.snapshot().remainingMs;
    advance(game, 5_000);
    expect(game.snapshot().remainingMs).toBe(before);
    expect(game.resume()).toBe(true);
  });

  it("reproduces the same run for the same seed and inputs", () => {
    const first = new TrafficGame();
    const second = new TrafficGame();
    first.start(20_260_812, "2026-08-12");
    second.start(20_260_812, "2026-08-12");

    const applyInputs = (game: TrafficGame, elapsedMs: number): void => {
      if (Math.abs(elapsedMs - 7_000) < FIXED_STEP_MS / 2) game.selectPhase("EAST_WEST");
      if (Math.abs(elapsedMs - 12_000) < FIXED_STEP_MS / 2) game.selectPhase("NORTH_SOUTH");
    };
    advance(first, 18_000, (elapsedMs) => applyInputs(first, elapsedMs));
    advance(second, 18_000, (elapsedMs) => applyInputs(second, elapsedMs));
    expect(first.snapshot()).toEqual(second.snapshot());
  });

  it("awards points to vehicles that pass safely", () => {
    const game = new TrafficGame();
    game.start(25, "2026-08-12");
    advance(game, 13_000);
    const snapshot = game.snapshot();
    expect(snapshot.passedVehicles).toBeGreaterThan(0);
    expect(snapshot.score).toBeGreaterThan(0);
    expect(snapshot.collisionCount).toBe(0);
  });

  it("limits ambulances to three with at least eighteen seconds between later spawns", () => {
    const game = new TrafficGame();
    game.start(71, "2026-08-12");
    advance(game, 3_050 + RUN_DURATION_MS);
    const spawnTimes = game
      .drainEvents()
      .flatMap((event) => (event.type === "EMERGENCY_SPAWNED" ? [event.elapsedMs] : []));
    expect(spawnTimes.length).toBeGreaterThanOrEqual(1);
    expect(spawnTimes.length).toBeLessThanOrEqual(3);
    for (let index = 1; index < spawnTimes.length; index += 1) {
      expect((spawnTimes[index] ?? 0) - (spawnTimes[index - 1] ?? 0)).toBeGreaterThanOrEqual(18_000);
    }
  });

  it("registers a collision when a new phase enters before the intersection clears", () => {
    const game = new TrafficGame();
    game.start(25, "2026-08-12");
    advance(game, 3_050 + 1_800);
    expect(game.selectPhase("EAST_WEST")).toBe(true);
    advance(game, 1_500);
    expect(game.snapshot().collisionCount).toBeGreaterThanOrEqual(1);
    const collisionSnapshot = game.snapshot();
    expect(collisionSnapshot.spilloverApproaches.length).toBe(2);
    expect(collisionSnapshot.brakingVehicleIds.length).toBeGreaterThan(0);
    expect(collisionSnapshot.gridlockLevel).toBeGreaterThan(0);
    const brakingVehicleId = collisionSnapshot.brakingVehicleIds[0];
    const beforeBrake = collisionSnapshot.vehicles.find((vehicle) => vehicle.id === brakingVehicleId);
    expect(beforeBrake).toBeDefined();
    advance(game, 300);
    const duringBrake = game.snapshot().vehicles.find((vehicle) => vehicle.id === brakingVehicleId);
    expect(duringBrake?.progress).toBeCloseTo(beforeBrake?.progress ?? 0, 5);
    const events = game.drainEvents();
    expect(events.some((event) => event.type === "COLLISION")).toBe(true);
    expect(events.some((event) => event.type === "SUDDEN_BRAKE_STARTED")).toBe(true);

    advance(game, 4_800);
    expect(game.snapshot().spilloverApproaches).toHaveLength(0);
    expect(game.snapshot().gridlockLevel).toBe(0);
  });

  it("finishes after the sixty-second play clock", () => {
    const game = new TrafficGame();
    game.start(99, "2026-08-12");
    advance(game, 3_050 + RUN_DURATION_MS + 100);
    expect(game.snapshot().status).toBe("RESULT");
    expect(game.currentResult()?.reason).toBe("TIME");
  });
});
