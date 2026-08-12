import { VEHICLE_HEIGHT, VEHICLE_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from "../game/config";
import { vehiclePosition, vehicleRotation } from "../game/trafficMath";
import type { Approach, GameSnapshot, SignalPhase, Vehicle } from "../game/types";
import { CAR_IMAGE_KEYS, type ImageAssets, type ImageKey } from "./assets";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifeMs: number;
  readonly totalLifeMs: number;
  readonly color: string;
  readonly size: number;
}

interface Decoration {
  readonly key: ImageKey;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
}

const DECORATIONS: readonly Decoration[] = [
  { key: "treeLarge", x: 90, y: 90, width: 128, height: 128 },
  { key: "treeSmall", x: 250, y: 145, width: 86, height: 86 },
  { key: "treeLarge", x: 1080, y: 105, width: 122, height: 122 },
  { key: "treeSmall", x: 965, y: 565, width: 88, height: 88 },
  { key: "treeLarge", x: 170, y: 580, width: 124, height: 124 },
  { key: "rock1", x: 350, y: 150, width: 45, height: 45 },
  { key: "rock2", x: 920, y: 120, width: 38, height: 38 },
  { key: "barrier", x: 330, y: 600, width: 118, height: 35, rotation: -0.08 },
  { key: "barrier", x: 845, y: 105, width: 118, height: 35, rotation: 0.08 },
  { key: "cone", x: 435, y: 180, width: 26, height: 31 },
  { key: "cone", x: 830, y: 540, width: 26, height: 31 },
];

const SPILLOVER_ZONES: Readonly<Record<Approach, { x: number; y: number; width: number; height: number }>> = {
  NORTH: { x: 535, y: 4, width: 110, height: 210 },
  SOUTH: { x: 635, y: 545, width: 110, height: 171 },
  WEST: { x: 4, y: 305, width: 455, height: 90 },
  EAST: { x: 820, y: 385, width: 456, height: 90 },
};

const CAR_FALLBACKS: Readonly<Record<Vehicle["color"], string>> = {
  RED: "#ff7d27",
  BLUE: "#3d9cf0",
  GREEN: "#2ec779",
  YELLOW: "#ffd02e",
  BLACK: "#586268",
};

export class Renderer {
  private readonly context: CanvasRenderingContext2D;
  private assets: ImageAssets = {};
  private particles: Particle[] = [];
  private lastRenderMs = 0;
  private reducedMotion = false;
  private grassPattern: CanvasPattern | null = null;
  private cssWidth = WORLD_WIDTH;
  private cssHeight = WORLD_HEIGHT;
  private pixelRatio = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D를 사용할 수 없습니다.");
    this.context = context;
  }

  setAssets(assets: ImageAssets): void {
    this.assets = assets;
    const grass = assets.grass;
    this.grassPattern = grass ? this.context.createPattern(grass, "repeat") : null;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, bounds.width);
    this.cssHeight = Math.max(1, bounds.height);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(this.cssWidth * this.pixelRatio);
    const height = Math.round(this.cssHeight * this.pixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      const grass = this.assets.grass;
      this.grassPattern = grass ? this.context.createPattern(grass, "repeat") : null;
    }
  }

  emitCollision(snapshot: GameSnapshot): void {
    const crashed = snapshot.vehicles.filter((vehicle) => vehicle.state === "CRASHED");
    if (crashed.length === 0) return;
    const positions = crashed.map(vehiclePosition);
    const center = positions.reduce(
      (sum, position) => ({ x: sum.x + position.x / positions.length, y: sum.y + position.y / positions.length }),
      { x: 0, y: 0 },
    );
    const count = this.reducedMotion ? 8 : 22;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const speed = 70 + (index % 5) * 28;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        lifeMs: 650,
        totalLifeMs: 650,
        color: index % 2 === 0 ? "#ff4f35" : "#ffd43b",
        size: 8 + (index % 3) * 4,
      });
    }
  }

  render(snapshot: GameSnapshot, nowMs: number): void {
    const deltaMs = this.lastRenderMs === 0 ? 0 : Math.min(50, nowMs - this.lastRenderMs);
    this.lastRenderMs = nowMs;
    this.updateParticles(deltaMs);
    this.prepareViewport(snapshot);
    this.drawWorld(snapshot, nowMs);
    this.restoreScreenSpace();
  }

  private prepareViewport(snapshot: GameSnapshot): void {
    const portrait = this.cssWidth / this.cssHeight < 0.82;
    const view = portrait
      ? { x: 330, y: 0, width: 620, height: WORLD_HEIGHT }
      : { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    const scale = Math.min(this.cssWidth / view.width, this.cssHeight / view.height);
    const offsetX = (this.cssWidth - view.width * scale) / 2;
    const offsetY = (this.cssHeight - view.height * scale) / 2;
    const shake = snapshot.collisionCount > 0 && !this.reducedMotion ? this.collisionShake(snapshot) : 0;
    this.context.setTransform(
      this.pixelRatio * scale,
      0,
      0,
      this.pixelRatio * scale,
      this.pixelRatio * (offsetX - view.x * scale + shake),
      this.pixelRatio * (offsetY - view.y * scale),
    );
    this.context.imageSmoothingEnabled = true;
  }

  private collisionShake(snapshot: GameSnapshot): number {
    const activeCrash = snapshot.vehicles.find((vehicle) => vehicle.state === "CRASHED" && vehicle.crashAgeMs < 300);
    if (!activeCrash) return 0;
    return Math.sin(activeCrash.crashAgeMs * 0.08) * (1 - activeCrash.crashAgeMs / 300) * 9;
  }

  private restoreScreenSpace(): void {
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  private drawWorld(snapshot: GameSnapshot, nowMs: number): void {
    const ctx = this.context;
    ctx.clearRect(-500, -500, WORLD_WIDTH + 1_000, WORLD_HEIGHT + 1_000);
    ctx.fillStyle = this.grassPattern ?? "#27bd70";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawRoads();
    this.drawSpillover(snapshot, nowMs);
    this.drawDecorations();
    this.drawSignals(snapshot);
    this.drawVehicles(snapshot);
    this.drawParticles();
  }

  private drawSpillover(snapshot: GameSnapshot, nowMs: number): void {
    if (snapshot.spilloverApproaches.length === 0) return;
    const ctx = this.context;
    const pulse = this.reducedMotion ? 0.28 : 0.2 + (Math.sin(nowMs * 0.012) + 1) * 0.08;
    for (const approach of snapshot.spilloverApproaches) {
      const zone = SPILLOVER_ZONES[approach];
      ctx.save();
      ctx.fillStyle = `rgba(255, 65, 42, ${pulse})`;
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.strokeStyle = "rgba(255, 222, 72, .9)";
      ctx.lineWidth = 5;
      ctx.setLineDash([16, 12]);
      ctx.strokeRect(zone.x + 3, zone.y + 3, zone.width - 6, zone.height - 6);
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff4c2";
      ctx.strokeStyle = "rgba(65, 20, 8, .8)";
      ctx.lineWidth = 6;
      ctx.font = "900 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const labelX = zone.x + zone.width / 2;
      const labelY = zone.height < zone.width ? zone.y + 19 : zone.y + 30;
      ctx.strokeText("! 급정거", labelX, labelY);
      ctx.fillText("! 급정거", labelX, labelY);
      ctx.restore();
    }
  }

  private drawRoads(): void {
    const ctx = this.context;
    ctx.fillStyle = "#b8d3d6";
    ctx.fillRect(500, 0, 280, WORLD_HEIGHT);
    ctx.fillRect(0, 250, WORLD_WIDTH, 260);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.34)";
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 24]);
    ctx.beginPath();
    ctx.moveTo(640, 0);
    ctx.lineTo(640, 250);
    ctx.moveTo(640, 510);
    ctx.lineTo(640, WORLD_HEIGHT);
    ctx.moveTo(0, 380);
    ctx.lineTo(500, 380);
    ctx.moveTo(780, 380);
    ctx.lineTo(WORLD_WIDTH, 380);
    ctx.stroke();
    ctx.restore();

    this.drawCurbs();
    this.drawStopLines();
    this.drawRoadArrows();
  }

  private drawCurbs(): void {
    this.drawStripedCurb(0, 236, 500, 14, false);
    this.drawStripedCurb(780, 236, 500, 14, false);
    this.drawStripedCurb(0, 510, 500, 14, false);
    this.drawStripedCurb(780, 510, 500, 14, false);
    this.drawStripedCurb(486, 0, 14, 250, true);
    this.drawStripedCurb(780, 0, 14, 250, true);
    this.drawStripedCurb(486, 510, 14, 210, true);
    this.drawStripedCurb(780, 510, 14, 210, true);
  }

  private drawStripedCurb(x: number, y: number, width: number, height: number, vertical: boolean): void {
    const segment = 24;
    const length = vertical ? height : width;
    for (let offset = 0; offset < length; offset += segment) {
      this.context.fillStyle = Math.floor(offset / segment) % 2 === 0 ? "#f26c21" : "#fff7e6";
      this.context.fillRect(
        vertical ? x : x + offset,
        vertical ? y + offset : y,
        vertical ? width : Math.min(segment, length - offset),
        vertical ? Math.min(segment, length - offset) : height,
      );
    }
  }

  private drawStopLines(): void {
    const ctx = this.context;
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.fillRect(506, 224, 124, 8);
    ctx.fillRect(650, 528, 124, 8);
    ctx.fillRect(474, 388, 8, 112);
    ctx.fillRect(798, 258, 8, 112);
  }

  private drawRoadArrows(): void {
    const arrow = this.assets.arrow;
    if (!arrow) return;
    this.drawRotatedImage(arrow, 590, 140, 66, 40, Math.PI);
    this.drawRotatedImage(arrow, 690, 610, 66, 40, 0);
    this.drawRotatedImage(arrow, 360, 350, 66, 40, Math.PI / 2);
    this.drawRotatedImage(arrow, 920, 430, 66, 40, -Math.PI / 2);
  }

  private drawDecorations(): void {
    for (const item of DECORATIONS) {
      const image = this.assets[item.key];
      if (!image) continue;
      this.drawRotatedImage(image, item.x, item.y, item.width, item.height, item.rotation ?? 0);
    }
  }

  private drawSignals(snapshot: GameSnapshot): void {
    this.drawSignal(455, 178, this.signalColor(snapshot, "NORTH_SOUTH"));
    this.drawSignal(810, 525, this.signalColor(snapshot, "NORTH_SOUTH"));
    this.drawSignal(430, 540, this.signalColor(snapshot, "EAST_WEST"));
    this.drawSignal(825, 165, this.signalColor(snapshot, "EAST_WEST"));
  }

  private signalColor(snapshot: GameSnapshot, phase: SignalPhase): "RED" | "AMBER" | "GREEN" {
    if (snapshot.signal.mode === "ALL_RED") return "RED";
    if (snapshot.signal.activePhase !== phase) return "RED";
    return snapshot.signal.mode === "AMBER" ? "AMBER" : "GREEN";
  }

  private drawSignal(x: number, y: number, active: "RED" | "AMBER" | "GREEN"): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(8,26,25,.28)";
    ctx.beginPath();
    ctx.roundRect(-25, -51, 56, 108, 18);
    ctx.fill();
    ctx.fillStyle = "#243230";
    ctx.beginPath();
    ctx.roundRect(-29, -56, 56, 108, 17);
    ctx.fill();
    const colors = { RED: "#ff4d42", AMBER: "#ffd039", GREEN: "#37e067" } as const;
    (["RED", "AMBER", "GREEN"] as const).forEach((color, index) => {
      ctx.fillStyle = active === color ? colors[color] : "#4b5142";
      ctx.beginPath();
      ctx.arc(-1, -36 + index * 34, 10, 0, Math.PI * 2);
      ctx.fill();
      if (active === color) {
        ctx.strokeStyle = `${colors[color]}88`;
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  private drawVehicles(snapshot: GameSnapshot): void {
    const vehicles = [...snapshot.vehicles].sort((first, second) => Number(first.state === "CRASHED") - Number(second.state === "CRASHED"));
    for (const vehicle of vehicles) this.drawVehicle(vehicle, snapshot.brakingVehicleIds.includes(vehicle.id));
  }

  private drawVehicle(vehicle: Readonly<Vehicle>, suddenBraking: boolean): void {
    const position = vehiclePosition(vehicle);
    const rotation = vehicleRotation(vehicle.approach);
    const image = vehicle.emergency ? this.assets.ambulance : this.assets[CAR_IMAGE_KEYS[vehicle.color]];
    const vehicleWidth = vehicle.emergency ? 46 : VEHICLE_WIDTH;
    const vehicleHeight = vehicle.emergency ? 78 : VEHICLE_HEIGHT;
    const ctx = this.context;
    ctx.save();
    ctx.translate(position.x, position.y);
    const crashRotation = vehicle.state === "CRASHED" ? Math.sin(vehicle.crashAgeMs * 0.02) * 0.22 : 0;
    ctx.rotate(rotation + crashRotation);
    ctx.fillStyle = "rgba(8,28,28,.22)";
    ctx.beginPath();
    ctx.ellipse(4, 7, vehicleWidth * 0.55, vehicleHeight * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    if (image) {
      ctx.drawImage(image, -vehicleWidth / 2, -vehicleHeight / 2, vehicleWidth, vehicleHeight);
    } else {
      this.drawFallbackCar(vehicle.color);
    }
    if (vehicle.emergency) this.drawEmergencyGlow();
    if (suddenBraking) this.drawBrakeWarning(vehicleHeight);
    ctx.restore();
  }

  private drawBrakeWarning(vehicleHeight: number): void {
    const ctx = this.context;
    const y = -vehicleHeight / 2 - 22;
    ctx.fillStyle = "#ffd43b";
    ctx.strokeStyle = "#5d2514";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y - 15);
    ctx.lineTo(16, y + 12);
    ctx.lineTo(-16, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5d2514";
    ctx.font = "900 19px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 0, y + 3);
  }

  private drawEmergencyGlow(): void {
    const ctx = this.context;
    const redActive = Math.floor(performance.now() / 140) % 2 === 0;
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = redActive ? "rgba(255, 45, 35, .55)" : "rgba(35, 130, 255, .55)";
    ctx.beginPath();
    ctx.ellipse(redActive ? -8 : 8, -7, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawFallbackCar(color: Vehicle["color"]): void {
    const ctx = this.context;
    ctx.fillStyle = CAR_FALLBACKS[color];
    ctx.beginPath();
    ctx.roundRect(-VEHICLE_WIDTH / 2, -VEHICLE_HEIGHT / 2, VEHICLE_WIDTH, VEHICLE_HEIGHT, 10);
    ctx.fill();
    ctx.fillStyle = "#edf8fb";
    ctx.fillRect(-13, -18, 26, 15);
    ctx.fillRect(-13, 8, 26, 15);
  }

  private drawRotatedImage(
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
  ): void {
    this.context.save();
    this.context.translate(x, y);
    this.context.rotate(rotation);
    this.context.drawImage(image, -width / 2, -height / 2, width, height);
    this.context.restore();
  }

  private updateParticles(deltaMs: number): void {
    for (const particle of this.particles) {
      particle.lifeMs -= deltaMs;
      particle.x += (particle.vx * deltaMs) / 1_000;
      particle.y += (particle.vy * deltaMs) / 1_000;
      particle.vy += (150 * deltaMs) / 1_000;
    }
    this.particles = this.particles.filter((particle) => particle.lifeMs > 0);
  }

  private drawParticles(): void {
    for (const particle of this.particles) {
      this.context.globalAlpha = particle.lifeMs / particle.totalLifeMs;
      this.context.fillStyle = particle.color;
      this.context.beginPath();
      this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.context.fill();
    }
    this.context.globalAlpha = 1;
  }
}
