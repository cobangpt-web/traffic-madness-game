import { ALL_RED_DURATION_MS, AMBER_DURATION_MS } from "./config";
import type { Approach, SignalPhase, SignalSnapshot } from "./types";

function approachPhase(approach: Approach): SignalPhase {
  return approach === "NORTH" || approach === "SOUTH" ? "NORTH_SOUTH" : "EAST_WEST";
}

export class SignalController {
  private activePhase: SignalPhase = "NORTH_SOUTH";
  private targetPhase: SignalPhase = "NORTH_SOUTH";
  private mode: SignalSnapshot["mode"] = "GREEN";
  private transitionRemainingMs = 0;

  reset(): void {
    this.activePhase = "NORTH_SOUTH";
    this.targetPhase = "NORTH_SOUTH";
    this.mode = "GREEN";
    this.transitionRemainingMs = 0;
  }

  request(phase: SignalPhase): boolean {
    if (this.mode !== "GREEN" || phase === this.activePhase) {
      return false;
    }
    this.targetPhase = phase;
    this.mode = "AMBER";
    this.transitionRemainingMs = AMBER_DURATION_MS;
    return true;
  }

  step(deltaMs: number): boolean {
    let remainingDelta = Math.max(0, deltaMs);
    let phaseChanged = false;

    while (remainingDelta > 0 && this.mode !== "GREEN") {
      const consumed = Math.min(remainingDelta, this.transitionRemainingMs);
      this.transitionRemainingMs -= consumed;
      remainingDelta -= consumed;

      if (this.transitionRemainingMs > 0) {
        continue;
      }

      if (this.mode === "AMBER") {
        this.mode = "ALL_RED";
        this.transitionRemainingMs = ALL_RED_DURATION_MS;
      } else {
        this.activePhase = this.targetPhase;
        this.mode = "GREEN";
        phaseChanged = true;
      }
    }

    return phaseChanged;
  }

  allows(approach: Approach): boolean {
    return this.mode === "GREEN" && approachPhase(approach) === this.activePhase;
  }

  snapshot(): SignalSnapshot {
    return {
      activePhase: this.activePhase,
      targetPhase: this.targetPhase,
      mode: this.mode,
      transitionRemainingMs: this.transitionRemainingMs,
    };
  }
}

