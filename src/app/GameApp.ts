import { AudioManager } from "../audio/AudioManager";
import { FIXED_STEP_MS } from "../game/config";
import { hashSeed, localDateKey } from "../game/random";
import { TrafficGame } from "../game/TrafficGame";
import type { GameEvent, SignalPhase, StageNumber } from "../game/types";
import { loadGameAssets } from "../rendering/assets";
import { Renderer } from "../rendering/Renderer";
import { GameStorage } from "../storage/gameStorage";
import { DomView } from "../ui/DomView";

export class GameApp {
  private readonly view = new DomView();
  private readonly game = new TrafficGame();
  private readonly renderer = new Renderer(this.view.canvas);
  private readonly audio = new AudioManager();
  private readonly storage = new GameStorage(window.localStorage);
  private readonly resizeObserver = new ResizeObserver(() => this.renderer.resize());
  private readonly dateKey = localDateKey();
  private bestScore = 0;
  private selectedStage: StageNumber = 1;
  private lastFrameMs = 0;
  private accumulatorMs = 0;
  private animationFrame = 0;

  async initialize(): Promise<void> {
    this.bestScore = this.storage.loadBest(this.dateKey);
    this.view.setStageSelection(this.selectedStage);
    this.audio.setMuted(this.storage.isMuted());
    this.view.setMuted(this.audio.isMuted());
    this.view.setDailyLabel(this.dateKey);
    this.view.setLoading();
    this.bindEvents();
    this.configureMotionPreference();
    this.renderer.resize();
    this.resizeObserver.observe(this.view.canvas);
    this.animationFrame = requestAnimationFrame(this.animate);

    const loaded = await loadGameAssets();
    this.renderer.setAssets(loaded.images);
    this.view.setAssetsReady(loaded.failures);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
  }

  private readonly animate = (nowMs: number): void => {
    if (this.lastFrameMs === 0) this.lastFrameMs = nowMs;
    const frameDeltaMs = Math.min(250, Math.max(0, nowMs - this.lastFrameMs));
    this.lastFrameMs = nowMs;
    this.accumulatorMs += frameDeltaMs;

    while (this.accumulatorMs >= FIXED_STEP_MS) {
      this.game.step(FIXED_STEP_MS);
      this.accumulatorMs -= FIXED_STEP_MS;
    }

    this.handleEvents(this.game.drainEvents());
    const snapshot = this.game.snapshot();
    this.view.update(snapshot, this.bestScore);
    this.renderer.render(snapshot, nowMs);
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private bindEvents(): void {
    this.view.startButton.addEventListener("click", this.startRun);
    this.view.restartButton.addEventListener("click", this.startRun);
    this.view.restartFromPauseButton.addEventListener("click", this.startRun);
    this.view.stageSelectButton.addEventListener("click", this.openStageSelection);
    this.view.resumeButton.addEventListener("click", this.resumeRun);
    this.view.pauseButton.addEventListener("click", this.togglePause);
    this.view.northSouthButton.addEventListener("click", () => this.requestPhase("NORTH_SOUTH"));
    this.view.eastWestButton.addEventListener("click", () => this.requestPhase("EAST_WEST"));
    this.view.soundButton.addEventListener("click", this.toggleSound);
    this.view.stageOneButton.addEventListener("click", () => this.selectStage(1));
    window.addEventListener("keydown", this.handleKeydown);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private configureMotionPreference(): void {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => this.renderer.setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
  }

  private readonly startRun = (): void => {
    this.bestScore = this.storage.loadBest(this.dateKey, this.selectedStage);
    this.game.start(hashSeed(`${this.dateKey}:stage:${this.selectedStage}`), this.dateKey, this.selectedStage);
    this.view.hideStart();
    this.view.hideResult();
    this.view.showPause(false);
    this.view.focusGame();
    this.storage.markTutorialSeen();
    this.audio.activate();
    this.audio.play("select");
  };

  private selectStage(stage: StageNumber): void {
    if (this.game.snapshot().status !== "READY" && this.game.snapshot().status !== "RESULT") return;
    this.selectedStage = stage;
    this.bestScore = this.storage.loadBest(this.dateKey, stage);
    this.view.setStageSelection(stage);
  }

  private readonly openStageSelection = (): void => {
    this.view.showStageSelection();
  };

  private readonly togglePause = (): void => {
    const status = this.game.snapshot().status;
    if (status === "PLAYING") {
      if (this.game.pause()) this.view.showPause(true);
    } else if (status === "PAUSED") {
      this.resumeRun();
    }
  };

  private readonly resumeRun = (): void => {
    if (!this.game.resume()) return;
    this.view.showPause(false);
    this.audio.play("select");
    this.view.northSouthButton.focus();
  };

  private requestPhase(phase: SignalPhase): void {
    if (!this.game.selectPhase(phase)) return;
    this.audio.play("select");
  }

  private readonly toggleSound = (): void => {
    const muted = !this.audio.isMuted();
    this.audio.setMuted(muted);
    this.storage.setMuted(muted);
    this.view.setMuted(muted);
    if (!muted) this.audio.play("select");
  };

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === "Digit1" || event.code === "ArrowUp" || event.code === "ArrowDown") {
      event.preventDefault();
      this.requestPhase("NORTH_SOUTH");
    } else if (event.code === "Digit2" || event.code === "ArrowLeft" || event.code === "ArrowRight") {
      event.preventDefault();
      this.requestPhase("EAST_WEST");
    } else if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.togglePause();
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden && this.game.pause()) this.view.showPause(true);
  };

  private handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "RUN_STARTED":
          this.view.announce(event.stage === 2 ? "2단계 시작, 러시아워 웨이브를 버티세요" : "1단계 시작");
          break;
        case "SIGNAL_REQUESTED":
          this.view.announce(event.phase === "NORTH_SOUTH" ? "남북 신호 변경 중" : "동서 신호 변경 중");
          break;
        case "SIGNAL_CHANGED":
          this.audio.play("switch");
          break;
        case "EMERGENCY_SPAWNED":
          this.audio.playSiren();
          this.view.showToast("구급차 진입! 우선 신호를 열어주세요", "warning");
          this.view.announce(`${this.approachLabel(event.approach)} 방향에서 구급차가 진입합니다`);
          break;
        case "VEHICLE_PASSED":
          this.audio.play("pass");
          if (event.emergency) this.view.showToast(`구급차 우선 통과! +${event.points}`, "good");
          if (event.combo > 0 && event.combo % 5 === 0) this.view.showToast(`${event.combo} 콤보! +${event.points}`);
          break;
        case "COLLISION":
          this.renderer.emitCollision(this.game.snapshot());
          this.audio.play("collision");
          this.view.showToast(`충돌! ${event.collisionCount} / 3`, "danger");
          this.view.announce(`차량 충돌, 총 ${event.collisionCount}회`);
          break;
        case "SUDDEN_BRAKE_STARTED":
          this.audio.play("collision");
          this.view.showToast("앞차 급정거! 뒤 차량 연쇄 정체", "warning");
          this.view.announce("사고를 본 주변 접근로의 앞차가 급정거해 뒤 차량이 정체됩니다");
          break;
        case "RUSH_HOUR_WAVE_STARTED":
          this.view.showToast(`러시아워 웨이브 ${event.wave}/${event.totalWaves} 시작!`, "warning");
          this.view.announce(`러시아워 웨이브 ${event.wave} 시작, 교통량이 증가합니다`);
          break;
        case "RUSH_HOUR_WAVE_CLEARED":
          this.audio.play("pass");
          this.view.showToast(`웨이브 클리어! +${event.points}`, "good");
          break;
        case "GRIDLOCK":
          this.audio.play("collision");
          this.view.showToast(`${this.approachLabel(event.approach)} 방향 정체! -250`, "warning");
          break;
        case "RUN_FINISHED":
          this.finishRun(event.result);
          break;
      }
    }
  }

  private finishRun(result: Extract<GameEvent, { type: "RUN_FINISHED" }>["result"]): void {
    this.selectedStage = result.stage;
    const isNewBest = this.storage.saveBest(this.dateKey, result.score, result.stage);
    if (isNewBest) this.bestScore = result.score;
    this.audio.play("finish");
    this.view.showResult(result, isNewBest);
    this.view.announce(`게임 종료, 최종 점수 ${result.score.toLocaleString("ko-KR")}점`);
    if (!this.storage.isHealthy()) this.view.showToast("기록을 저장할 수 없는 브라우저 환경입니다", "warning");
  }

  private approachLabel(approach: Extract<GameEvent, { type: "GRIDLOCK" }>["approach"]): string {
    return { NORTH: "북쪽", SOUTH: "남쪽", EAST: "동쪽", WEST: "서쪽" }[approach];
  }
}
