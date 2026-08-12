import { describe, expect, it } from "vitest";
import { scoreForCombo, spawnIntervalMs, vehiclePosition, vehiclesCollide } from "./trafficMath";
import type { Vehicle } from "./types";

function vehicle(overrides: Partial<Vehicle>): Vehicle {
  return {
    id: "test",
    approach: "NORTH",
    color: "RED",
    progress: 440,
    speed: 130,
    state: "CROSSING",
    crashAgeMs: 0,
    ...overrides,
  };
}

describe("traffic geometry", () => {
  it("maps path progress to world coordinates", () => {
    expect(vehiclePosition(vehicle({ approach: "WEST", progress: 680 }))).toEqual({ x: 590, y: 350 });
  });

  it("detects orthogonal overlap inside the intersection", () => {
    const northbound = vehicle({ approach: "NORTH", progress: 440 });
    const westbound = vehicle({ approach: "WEST", progress: 680 });
    expect(vehiclesCollide(northbound, westbound)).toBe(true);
  });

  it("treats exact edge contact as non-overlap", () => {
    const northbound = vehicle({ approach: "NORTH", progress: 440 });
    const westbound = vehicle({ approach: "WEST", progress: 734 });
    expect(vehiclesCollide(northbound, westbound)).toBe(false);
  });

  it("does not collide vehicles traveling on parallel lanes", () => {
    expect(vehiclesCollide(vehicle({ approach: "NORTH" }), vehicle({ approach: "SOUTH" }))).toBe(false);
  });
});

describe("difficulty and score", () => {
  it("caps the combo bonus", () => {
    expect(scoreForCombo(1)).toBe(100);
    expect(scoreForCombo(6)).toBe(150);
    expect(scoreForCombo(100)).toBe(300);
  });

  it("increases traffic density every fifteen seconds", () => {
    expect([0, 15_000, 30_000, 45_000].map(spawnIntervalMs)).toEqual([2_100, 1_750, 1_450, 1_150]);
  });
});

