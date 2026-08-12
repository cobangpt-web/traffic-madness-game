import { describe, expect, it } from "vitest";
import { ALL_RED_DURATION_MS, AMBER_DURATION_MS } from "./config";
import { SignalController } from "./signal";

describe("SignalController", () => {
  it("never enables opposing phases during a transition", () => {
    const signal = new SignalController();
    expect(signal.allows("NORTH")).toBe(true);
    expect(signal.allows("EAST")).toBe(false);

    expect(signal.request("EAST_WEST")).toBe(true);
    expect(signal.snapshot().mode).toBe("AMBER");
    expect(signal.allows("NORTH")).toBe(false);
    expect(signal.allows("EAST")).toBe(false);

    signal.step(AMBER_DURATION_MS);
    expect(signal.snapshot().mode).toBe("ALL_RED");
    expect(signal.allows("NORTH")).toBe(false);
    expect(signal.allows("EAST")).toBe(false);

    expect(signal.step(ALL_RED_DURATION_MS)).toBe(true);
    expect(signal.snapshot().mode).toBe("GREEN");
    expect(signal.allows("NORTH")).toBe(false);
    expect(signal.allows("EAST")).toBe(true);
  });

  it("ignores duplicate and mid-transition requests", () => {
    const signal = new SignalController();
    expect(signal.request("NORTH_SOUTH")).toBe(false);
    expect(signal.request("EAST_WEST")).toBe(true);
    expect(signal.request("NORTH_SOUTH")).toBe(false);
  });

  it("carries a large step through both transition states", () => {
    const signal = new SignalController();
    signal.request("EAST_WEST");
    expect(signal.step(AMBER_DURATION_MS + ALL_RED_DURATION_MS)).toBe(true);
    expect(signal.snapshot()).toMatchObject({ activePhase: "EAST_WEST", mode: "GREEN" });
  });
});

