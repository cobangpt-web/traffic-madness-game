import {
  COLLISION_LIMIT,
  COUNTDOWN_MS,
  EMERGENCY_MIN_INTERVAL_MS,
  GRIDLOCK_QUEUE_SIZE,
  MAX_EMERGENCIES_PER_RUN,
  PATHS,
  RUSH_HOUR_TOTAL_WAVES,
  RUSH_HOUR_WAVE_CLEAR_POINTS,
  RUSH_HOUR_WAVE_DURATION_MS,
  RUN_DURATION_MS,
  SPILLOVER_DURATION_MS,
  SPILLOVER_RECOVERY_SPEED_FACTOR,
  SUDDEN_BRAKE_DURATION_MS,
  VEHICLE_GAP,
} from "./config";
import { SeededRandom } from "./random";
import { SignalController } from "./signal";
import { isVerticalApproach, rushHourSpawnIntervalMs, scoreForCombo, spawnIntervalMs, vehiclesCollide } from "./trafficMath";
import {
  APPROACHES,
  CAR_COLORS,
  type Approach,
  type FinishReason,
  type GameEvent,
  type GameSnapshot,
  type GameStatus,
  type RunResult,
  type SignalPhase,
  type StageNumber,
  type Vehicle,
} from "./types";

const MAX_STEP_MS = 100;
const CRASH_VISIBLE_MS = 850;

interface SpilloverState {
  remainingMs: number;
  blockerVehicleId: string | null;
}

export class TrafficGame {
  private stage: StageNumber = 1;
  private status: GameStatus = "READY";
  private countdownMs = COUNTDOWN_MS;
  private remainingMs = RUN_DURATION_MS;
  private elapsedMs = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private collisionCount = 0;
  private passedVehicles = 0;
  private emergencyBonuses = 0;
  private comboColor: Vehicle["color"] | null = null;
  private gridlockLevel = 0;
  private readonly spillover = new Map<Approach, SpilloverState>();
  private rushHourWave = 0;
  private rushHourWaveRemainingMs = 0;
  private rushHourWavesCleared = 0;
  private dailySeed = "";
  private random = new SeededRandom(1);
  private readonly signal = new SignalController();
  private vehicles: Vehicle[] = [];
  private events: GameEvent[] = [];
  private spawnRemainingMs = 0;
  private nextVehicleId = 1;
  private emergencySpawnedCount = 0;
  private lastEmergencySpawnMs = Number.NEGATIVE_INFINITY;
  private readonly gridlocked = new Set<Approach>();
  private result: RunResult | null = null;

  start(seed: number, dailySeed: string, stage: StageNumber = 1): void {
    this.stage = stage;
    this.status = "COUNTDOWN";
    this.countdownMs = COUNTDOWN_MS;
    this.remainingMs = RUN_DURATION_MS;
    this.elapsedMs = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.collisionCount = 0;
    this.passedVehicles = 0;
    this.emergencyBonuses = 0;
    this.comboColor = null;
    this.gridlockLevel = 0;
    this.spillover.clear();
    this.rushHourWave = 0;
    this.rushHourWaveRemainingMs = 0;
    this.rushHourWavesCleared = 0;
    this.dailySeed = dailySeed;
    this.random = new SeededRandom(seed);
    this.signal.reset();
    this.vehicles = [];
    this.events = [];
    this.spawnRemainingMs = 0;
    this.nextVehicleId = 1;
    this.emergencySpawnedCount = 0;
    this.lastEmergencySpawnMs = Number.NEGATIVE_INFINITY;
    this.gridlocked.clear();
    this.result = null;
    this.seedOpeningTraffic();
  }

  selectPhase(phase: SignalPhase): boolean {
    if (this.status !== "PLAYING" || !this.signal.request(phase)) {
      return false;
    }
    this.events.push({ type: "SIGNAL_REQUESTED", phase });
    return true;
  }

  pause(): boolean {
    if (this.status !== "PLAYING") return false;
    this.status = "PAUSED";
    return true;
  }

  resume(): boolean {
    if (this.status !== "PAUSED") return false;
    this.status = "PLAYING";
    return true;
  }

  step(deltaMs: number): void {
    const safeDeltaMs = Math.min(MAX_STEP_MS, Math.max(0, deltaMs));
    if (safeDeltaMs === 0) return;

    if (this.status === "COUNTDOWN") {
      this.stepCountdown(safeDeltaMs);
      return;
    }
    if (this.status !== "PLAYING") return;

    this.elapsedMs += safeDeltaMs;
    this.remainingMs = Math.max(0, this.remainingMs - safeDeltaMs);
    if (this.signal.step(safeDeltaMs)) {
      this.events.push({ type: "SIGNAL_CHANGED", phase: this.signal.snapshot().activePhase });
    }

    this.stepRushHourWave();
    this.stepSpawning(safeDeltaMs);
    this.stepSpillover(safeDeltaMs);
    this.stepVehicles(safeDeltaMs);
    this.detectCollisions();
    this.detectGridlock();
    this.removeFinishedVehicles();

    if (this.remainingMs === 0) {
      this.finish("TIME");
    }
  }

  snapshot(): GameSnapshot {
    return {
      stage: this.stage,
      status: this.status,
      countdownMs: this.countdownMs,
      remainingMs: this.remainingMs,
      elapsedMs: this.elapsedMs,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      collisionCount: this.collisionCount,
      passedVehicles: this.passedVehicles,
      emergencyBonuses: this.emergencyBonuses,
      gridlockLevel: this.gridlockLevel,
      spilloverApproaches: [...this.spillover.keys()],
      brakingVehicleIds: [...this.spillover.values()]
        .map((state) => state.blockerVehicleId)
        .filter((vehicleId): vehicleId is string => vehicleId !== null),
      rushHourWave: this.rushHourWave,
      rushHourWaveRemainingMs: this.rushHourWaveRemainingMs,
      rushHourWavesCleared: this.rushHourWavesCleared,
      dailySeed: this.dailySeed,
      signal: this.signal.snapshot(),
      vehicles: this.vehicles.map((vehicle) => ({ ...vehicle })),
    };
  }

  currentResult(): RunResult | null {
    return this.result ? { ...this.result } : null;
  }

  drainEvents(): GameEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  private stepCountdown(deltaMs: number): void {
    this.countdownMs = Math.max(0, this.countdownMs - deltaMs);
    if (this.countdownMs > 0) return;
    this.status = "PLAYING";
    this.spawnRemainingMs = 500;
    this.events.push({ type: "RUN_STARTED", stage: this.stage });
  }

  private stepRushHourWave(): void {
    if (this.stage !== 2) {
      this.rushHourWaveRemainingMs = 0;
      return;
    }

    const nextWave = Math.min(
      RUSH_HOUR_TOTAL_WAVES,
      Math.floor(this.elapsedMs / RUSH_HOUR_WAVE_DURATION_MS) + 1,
    );
    if (nextWave !== this.rushHourWave) {
      if (this.rushHourWave > 0) this.clearRushHourWave(this.rushHourWave);
      this.rushHourWave = nextWave;
      this.spawnRemainingMs = 0;
      this.events.push({
        type: "RUSH_HOUR_WAVE_STARTED",
        wave: nextWave,
        totalWaves: RUSH_HOUR_TOTAL_WAVES,
      });
    }

    const waveEndMs = Math.min(RUN_DURATION_MS, this.rushHourWave * RUSH_HOUR_WAVE_DURATION_MS);
    this.rushHourWaveRemainingMs = Math.max(0, waveEndMs - this.elapsedMs);
  }

  private clearRushHourWave(wave: number): void {
    if (this.rushHourWavesCleared >= wave) return;
    this.rushHourWavesCleared = wave;
    this.score += RUSH_HOUR_WAVE_CLEAR_POINTS;
    this.events.push({ type: "RUSH_HOUR_WAVE_CLEARED", wave, points: RUSH_HOUR_WAVE_CLEAR_POINTS });
  }

  private seedOpeningTraffic(): void {
    for (const approach of APPROACHES) {
      const path = PATHS[approach];
      this.spawnVehicle(approach, Math.max(40, path.stopProgress - 185 - this.random.next() * 55));
    }
  }

  private stepSpawning(deltaMs: number): void {
    this.spawnRemainingMs -= deltaMs;
    if (this.spawnRemainingMs > 0) return;

    const preferred = this.random.integer(APPROACHES.length);
    let spawned = false;
    for (let offset = 0; offset < APPROACHES.length; offset += 1) {
      const approach = APPROACHES[(preferred + offset) % APPROACHES.length];
      if (approach && this.canSpawn(approach)) {
        this.spawnVehicle(approach, 0);
        spawned = true;
        break;
      }
    }

    const baseInterval = this.stage === 2 ? rushHourSpawnIntervalMs(this.rushHourWave) : spawnIntervalMs(this.elapsedMs);
    const jitter = 0.78 + this.random.next() * 0.44;
    this.spawnRemainingMs = spawned ? baseInterval * jitter : 320;
  }

  private canSpawn(approach: Approach): boolean {
    return !this.vehicles.some(
      (vehicle) => vehicle.approach === approach && vehicle.state !== "CRASHED" && vehicle.progress < VEHICLE_GAP,
    );
  }

  private spawnVehicle(approach: Approach, progress: number): void {
    const color = CAR_COLORS[this.random.integer(CAR_COLORS.length)] ?? "RED";
    const emergencyRoll = this.random.next();
    const firstEmergencyDue = this.emergencySpawnedCount === 0 && this.elapsedMs >= 4_000;
    const emergencyCooldownReady = this.elapsedMs - this.lastEmergencySpawnMs >= EMERGENCY_MIN_INTERVAL_MS;
    const randomEmergency =
      this.emergencySpawnedCount > 0 &&
      this.emergencySpawnedCount < MAX_EMERGENCIES_PER_RUN &&
      emergencyCooldownReady &&
      emergencyRoll < 0.12;
    const emergency = firstEmergencyDue || randomEmergency;
    const vehicleId = `car-${this.nextVehicleId}`;
    this.vehicles.push({
      id: vehicleId,
      approach,
      color,
      emergency,
      progress,
      speed: 126 + this.random.next() * 12,
      state: "APPROACHING",
      crashAgeMs: 0,
    });
    if (emergency) {
      this.emergencySpawnedCount += 1;
      this.lastEmergencySpawnMs = this.elapsedMs;
      this.events.push({ type: "EMERGENCY_SPAWNED", vehicleId, approach, elapsedMs: this.elapsedMs });
    }
    this.nextVehicleId += 1;
  }

  private stepVehicles(deltaMs: number): void {
    for (const approach of APPROACHES) {
      const laneVehicles = this.vehicles
        .filter((vehicle) => vehicle.approach === approach && vehicle.state !== "CRASHED")
        .sort((first, second) => second.progress - first.progress);
      const spillover = this.spillover.get(approach);
      if (spillover && !spillover.blockerVehicleId) spillover.blockerVehicleId = this.findBrakeVehicle(approach);

      let leadProgress = Number.POSITIVE_INFINITY;
      for (const vehicle of laneVehicles) {
        const path = PATHS[approach];
        const suddenBrakeActive =
          spillover?.blockerVehicleId === vehicle.id &&
          spillover.remainingMs > SPILLOVER_DURATION_MS - SUDDEN_BRAKE_DURATION_MS;
        const speedFactor = spillover && !suddenBrakeActive ? SPILLOVER_RECOVERY_SPEED_FACTOR : 1;
        const desired = suddenBrakeActive
          ? vehicle.progress
          : vehicle.progress + (vehicle.speed * speedFactor * deltaMs) / 1_000;
        let cap = leadProgress - VEHICLE_GAP;
        const beforeStopLine = vehicle.progress <= path.stopProgress + 1;
        if (beforeStopLine && !this.signal.allows(approach)) {
          cap = Math.min(cap, path.stopProgress);
        }

        const nextProgress = Math.max(vehicle.progress, Math.min(desired, cap));
        const moved = nextProgress - vehicle.progress > 0.01;
        vehicle.progress = nextProgress;
        vehicle.state = this.vehicleState(vehicle, moved);
        leadProgress = vehicle.progress;
      }
    }

    for (const vehicle of this.vehicles) {
      if (vehicle.state === "CRASHED") vehicle.crashAgeMs += deltaMs;
    }
  }

  private stepSpillover(deltaMs: number): void {
    for (const [approach, state] of this.spillover) {
      const nextRemainingMs = state.remainingMs - deltaMs;
      if (nextRemainingMs <= 0) this.spillover.delete(approach);
      else state.remainingMs = nextRemainingMs;
    }
    this.gridlockLevel =
      this.spillover.size === 0 ? 0 : Math.max(...[...this.spillover.values()].map((state) => state.remainingMs));
  }

  private findBrakeVehicle(approach: Approach): string | null {
    const path = PATHS[approach];
    const laneVehicles = this.vehicles
      .filter((vehicle) => vehicle.approach === approach && vehicle.state !== "CRASHED")
      .sort((first, second) => second.progress - first.progress);
    const beforeIntersection = laneVehicles.find((vehicle) => vehicle.progress < path.intersectionStart);
    return beforeIntersection?.id ?? laneVehicles[0]?.id ?? null;
  }

  private vehicleState(vehicle: Vehicle, moved: boolean): Vehicle["state"] {
    const path = PATHS[vehicle.approach];
    if (vehicle.progress > path.intersectionEnd) return "EXITING";
    if (vehicle.progress >= path.intersectionStart) return "CROSSING";
    return moved ? "APPROACHING" : "WAITING";
  }

  private detectCollisions(): void {
    const vertical = this.vehicles.filter(
      (vehicle) => isVerticalApproach(vehicle.approach) && vehicle.state === "CROSSING",
    );
    const horizontal = this.vehicles.filter(
      (vehicle) => !isVerticalApproach(vehicle.approach) && vehicle.state === "CROSSING",
    );

    for (const first of vertical) {
      for (const second of horizontal) {
        if (!vehiclesCollide(first, second)) continue;
        first.state = "CRASHED";
        first.crashAgeMs = 0;
        second.state = "CRASHED";
        second.crashAgeMs = 0;
        this.score = Math.max(0, this.score - 500);
        this.combo = 0;
        this.collisionCount += 1;
        this.events.push({ type: "COLLISION", collisionCount: this.collisionCount });
        const affectedApproaches = APPROACHES.filter(
          (approach) => approach !== first.approach && approach !== second.approach,
        );
        for (const approach of affectedApproaches) {
          this.spillover.set(approach, {
            remainingMs: SPILLOVER_DURATION_MS,
            blockerVehicleId: this.findBrakeVehicle(approach),
          });
        }
        this.gridlockLevel = SPILLOVER_DURATION_MS;
        this.events.push({ type: "SUDDEN_BRAKE_STARTED", approaches: affectedApproaches });
        if (this.collisionCount >= COLLISION_LIMIT) this.finish("CRASH_LIMIT");
        return;
      }
    }
  }

  private detectGridlock(): void {
    for (const approach of APPROACHES) {
      const count = this.vehicles.filter(
        (vehicle) => vehicle.approach === approach && vehicle.state !== "CRASHED",
      ).length;
      if (count >= GRIDLOCK_QUEUE_SIZE && !this.gridlocked.has(approach)) {
        this.gridlocked.add(approach);
        this.score = Math.max(0, this.score - 250);
        this.combo = 0;
        this.events.push({ type: "GRIDLOCK", approach });
      } else if (count < GRIDLOCK_QUEUE_SIZE - 2) {
        this.gridlocked.delete(approach);
      }
    }
  }

  private removeFinishedVehicles(): void {
    const retained: Vehicle[] = [];
    for (const vehicle of this.vehicles) {
      if (vehicle.state === "CRASHED") {
        if (vehicle.crashAgeMs < CRASH_VISIBLE_MS) retained.push(vehicle);
        continue;
      }
      if (vehicle.progress <= PATHS[vehicle.approach].endProgress) {
        retained.push(vehicle);
        continue;
      }
      this.combo = this.comboColor === vehicle.color ? this.combo + 1 : 1;
      this.comboColor = vehicle.color;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.passedVehicles += 1;
      const emergencyBonus = vehicle.emergency ? 300 : 0;
      if (vehicle.emergency) this.emergencyBonuses += 1;
      const points = scoreForCombo(this.combo) + emergencyBonus;
      this.score += points;
      this.events.push({ type: "VEHICLE_PASSED", points, combo: this.combo, color: vehicle.color, emergency: Boolean(vehicle.emergency) });
    }
    this.vehicles = retained;
  }

  private finish(reason: FinishReason): void {
    if (this.status === "RESULT") return;
    if (this.stage === 2 && this.rushHourWaveRemainingMs === 0 && this.rushHourWave > 0) {
      this.clearRushHourWave(this.rushHourWave);
    }
    this.status = "RESULT";
    this.result = {
      stage: this.stage,
      dailySeed: this.dailySeed,
      score: this.score,
      maxCombo: this.maxCombo,
      passedVehicles: this.passedVehicles,
      collisions: this.collisionCount,
      emergencyBonuses: this.emergencyBonuses,
      rushHourWavesCleared: this.rushHourWavesCleared,
      reason,
    };
    this.events.push({ type: "RUN_FINISHED", result: { ...this.result } });
  }
}
