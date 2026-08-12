import type { GameSnapshot, RunResult, SignalPhase, StageNumber } from "../game/types";

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`필수 화면 요소가 없습니다: #${id}`);
  return element as T;
}

function setOverlay(element: HTMLElement, visible: boolean): void {
  if (!visible && element.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  element.inert = !visible;
  element.classList.toggle("is-visible", visible);
  element.setAttribute("aria-hidden", String(!visible));
}

function formatScore(score: number): string {
  return Math.max(0, Math.floor(score)).toLocaleString("ko-KR");
}

function formatTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

export class DomView {
  readonly canvas = requiredElement<HTMLCanvasElement>("game-canvas");
  readonly startButton = requiredElement<HTMLButtonElement>("start-button");
  readonly pauseButton = requiredElement<HTMLButtonElement>("pause-button");
  readonly resumeButton = requiredElement<HTMLButtonElement>("resume-button");
  readonly restartButton = requiredElement<HTMLButtonElement>("restart-button");
  readonly restartFromPauseButton = requiredElement<HTMLButtonElement>("restart-from-pause-button");
  readonly stageSelectButton = requiredElement<HTMLButtonElement>("stage-select-button");
  readonly northSouthButton = requiredElement<HTMLButtonElement>("north-south-button");
  readonly eastWestButton = requiredElement<HTMLButtonElement>("east-west-button");
  readonly soundButton = requiredElement<HTMLButtonElement>("sound-button");
  readonly stageOneButton = requiredElement<HTMLButtonElement>("stage-one-button");
  readonly stageTwoButton = requiredElement<HTMLButtonElement>("stage-two-button");

  private readonly startOverlay = requiredElement<HTMLElement>("start-overlay");
  private readonly pauseOverlay = requiredElement<HTMLElement>("pause-overlay");
  private readonly resultOverlay = requiredElement<HTMLElement>("result-overlay");
  private readonly scoreValue = requiredElement<HTMLElement>("score-value");
  private readonly timeValue = requiredElement<HTMLElement>("time-value");
  private readonly comboValue = requiredElement<HTMLElement>("combo-value");
  private readonly emergencyValue = requiredElement<HTMLElement>("emergency-value");
  private readonly bestValue = requiredElement<HTMLElement>("best-value");
  private readonly phaseLabel = requiredElement<HTMLElement>("phase-label");
  private readonly stageLabel = requiredElement<HTMLElement>("stage-label");
  private readonly dangerCount = requiredElement<HTMLElement>("danger-count");
  private readonly countdown = requiredElement<HTMLElement>("countdown");
  private readonly toast = requiredElement<HTMLElement>("toast");
  private readonly liveAnnouncement = requiredElement<HTMLElement>("live-announcement");
  private readonly dailyLabel = requiredElement<HTMLElement>("daily-label");
  private readonly startLead = requiredElement<HTMLElement>("start-lead");
  private readonly stageRuleOne = requiredElement<HTMLElement>("stage-rule-one");
  private readonly stageRuleTwo = requiredElement<HTMLElement>("stage-rule-two");
  private readonly resultEyebrow = requiredElement<HTMLElement>("result-eyebrow");
  private readonly resultTitle = requiredElement<HTMLElement>("result-title");
  private readonly resultScore = requiredElement<HTMLElement>("result-score");
  private readonly resultPassed = requiredElement<HTMLElement>("result-passed");
  private readonly resultCombo = requiredElement<HTMLElement>("result-combo");
  private readonly resultCollisions = requiredElement<HTMLElement>("result-collisions");
  private readonly resultEmergency = requiredElement<HTMLElement>("result-emergency");
  private readonly resultSpecialLabel = requiredElement<HTMLElement>("result-special-label");
  private readonly resultSpecial = requiredElement<HTMLElement>("result-special");
  private readonly newBest = requiredElement<HTMLElement>("new-best");
  private toastTimer = 0;
  private lastPhaseKey = "";
  private selectedStage: StageNumber = 1;

  setAssetsReady(failures: readonly string[]): void {
    this.startButton.disabled = false;
    this.setStageSelection(this.selectedStage);
    if (failures.length > 0) this.showToast(`에셋 ${failures.length}개는 기본 도형으로 표시됩니다`, "warning");
  }

  setLoading(): void {
    this.startButton.disabled = true;
    this.startButton.textContent = "에셋 불러오는 중…";
  }

  setDailyLabel(dateKey: string): void {
    const [, month, day] = dateKey.split("-");
    this.dailyLabel.textContent = `${month ?? "--"}월 ${day ?? "--"}일 · 오늘의 교차로`;
  }

  setStageSelection(stage: StageNumber): void {
    this.selectedStage = stage;
    this.stageOneButton.classList.toggle("is-selected", stage === 1);
    this.stageTwoButton.classList.toggle("is-selected", stage === 2);
    this.stageOneButton.setAttribute("aria-pressed", String(stage === 1));
    this.stageTwoButton.setAttribute("aria-pressed", String(stage === 2));
    this.stageLabel.textContent = stage === 2 ? "2단계 · 러시아워 웨이브" : "1단계 · 기본 교차로";
    this.startButton.textContent = stage === 2 ? "2단계 시작 · 러시아워 버티기" : "1단계 시작 · 교통 정리하기";
    if (stage === 2) {
      this.startLead.textContent = "10초마다 교통량이 폭증합니다. 60초 동안 6번의 러시아워 웨이브를 버티세요.";
      this.stageRuleOne.textContent = "웨이브가 올라갈수록 차량이 더 빠르게 몰려옵니다.";
      this.stageRuleTwo.textContent = "웨이브를 넘길 때마다 +300점, 정체가 쌓이면 즉시 감점됩니다.";
    } else {
    this.startLead.textContent = "신호를 바꿔, 폭주하는 교차로를 버텨라.";
      this.stageRuleOne.textContent = "남북·동서 버튼으로 녹색 방향을 바꿉니다.";
      this.stageRuleTwo.textContent = "교차로가 비기 전에 바꾸면 차가 충돌합니다.";
    }
  }

  update(snapshot: GameSnapshot, bestScore: number): void {
    setText(this.scoreValue, formatScore(snapshot.score));
    setText(this.timeValue, formatTime(snapshot.remainingMs));
    setText(this.comboValue, `×${snapshot.combo}`);
    setText(this.emergencyValue, `${snapshot.emergencyBonuses}회`);
    setText(this.stageLabel, snapshot.stage === 2 ? `2단계 · 러시아워 ${snapshot.rushHourWave}웨이브` : "1단계 · 기본 교차로");
    setText(this.bestValue, formatScore(Math.max(bestScore, snapshot.score)));
    const spilloverSeconds = Math.ceil(snapshot.gridlockLevel / 1_000);
    setText(
      this.dangerCount,
      spilloverSeconds > 0 ? `연쇄 정체 ${spilloverSeconds}초 · 충돌 ${snapshot.collisionCount} / 3` : `충돌 ${snapshot.collisionCount} / 3`,
    );
    this.dangerCount.classList.toggle("is-danger", snapshot.collisionCount >= 2 || spilloverSeconds > 0);
    this.pauseButton.disabled = snapshot.status !== "PLAYING" && snapshot.status !== "PAUSED";
    this.updateCountdown(snapshot);
    this.updatePhase(snapshot);
  }

  hideStart(): void {
    setOverlay(this.startOverlay, false);
  }

  showStageSelection(): void {
    setOverlay(this.resultOverlay, false);
    setOverlay(this.startOverlay, true);
    this.stageOneButton.focus();
  }

  focusGame(): void {
    this.canvas.focus({ preventScroll: true });
  }

  showPause(visible: boolean): void {
    setOverlay(this.pauseOverlay, visible);
    this.pauseButton.textContent = visible ? "▶" : "Ⅱ";
    this.pauseButton.setAttribute("aria-label", visible ? "계속하기" : "일시정지");
    if (visible) this.resumeButton.focus();
  }

  showResult(result: RunResult, isNewBest: boolean): void {
    this.resultTitle.textContent = result.reason === "CRASH_LIMIT" ? "교차로가 아수라장!" : result.stage === 2 ? "러시아워 생존 완료!" : "교통 정리 완료!";
    this.resultEyebrow.textContent = result.stage === 2 ? "2단계 러시아워 결과" : "1단계 관제 결과";
    this.resultScore.textContent = formatScore(result.score);
    this.resultPassed.textContent = `${result.passedVehicles}대`;
    this.resultCombo.textContent = `×${result.maxCombo}`;
    this.resultCollisions.textContent = `${result.collisions}회`;
    this.resultEmergency.textContent = `${result.emergencyBonuses}회`;
    this.resultSpecialLabel.textContent = result.stage === 2 ? "웨이브 클리어" : "특수 통과";
    this.resultSpecial.textContent = result.stage === 2 ? `${result.rushHourWavesCleared} / 6` : "-";
    this.newBest.hidden = !isNewBest;
    setOverlay(this.resultOverlay, true);
    this.restartButton.focus();
  }

  hideResult(): void {
    setOverlay(this.resultOverlay, false);
  }

  setMuted(muted: boolean): void {
    this.soundButton.textContent = muted ? "×" : "♪";
    this.soundButton.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
    this.soundButton.classList.toggle("is-muted", muted);
  }

  showToast(message: string, tone: "good" | "warning" | "danger" = "good"): void {
    window.clearTimeout(this.toastTimer);
    this.toast.textContent = message;
    this.toast.className = `toast is-visible is-${tone}`;
    this.toast.setAttribute("aria-hidden", "false");
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove("is-visible");
      this.toast.setAttribute("aria-hidden", "true");
    }, 1_100);
  }

  announce(message: string): void {
    this.liveAnnouncement.textContent = "";
    window.setTimeout(() => {
      this.liveAnnouncement.textContent = message;
    }, 20);
  }

  private updateCountdown(snapshot: GameSnapshot): void {
    if (snapshot.status !== "COUNTDOWN") {
      this.countdown.textContent = "";
      this.countdown.setAttribute("aria-hidden", "true");
      return;
    }
    const count = Math.max(1, Math.ceil(snapshot.countdownMs / 1_000));
    this.countdown.textContent = String(count);
    this.countdown.setAttribute("aria-hidden", "false");
  }

  private updatePhase(snapshot: GameSnapshot): void {
    const signal = snapshot.signal;
    const requestedPhase = signal.mode === "GREEN" ? signal.activePhase : signal.targetPhase;
    const phaseKey = `${snapshot.status}:${snapshot.stage}:${snapshot.rushHourWave}:${signal.activePhase}:${signal.targetPhase}:${signal.mode}:${snapshot.spilloverApproaches.join(",")}`;
    if (phaseKey === this.lastPhaseKey) return;
    this.lastPhaseKey = phaseKey;
    this.setActiveButton(requestedPhase, signal.mode === "GREEN" && snapshot.status === "PLAYING");

    if (snapshot.spilloverApproaches.length > 0) {
      setText(this.phaseLabel, "⚠ 앞차 급정거 · 뒤 차량 연쇄 정체");
    } else if (snapshot.stage === 2 && snapshot.rushHourWave > 0) {
      setText(this.phaseLabel, `러시아워 웨이브 ${snapshot.rushHourWave} · ${Math.ceil(snapshot.rushHourWaveRemainingMs / 1_000)}초`);
    } else if (signal.mode === "AMBER") {
      setText(this.phaseLabel, "노란불 · 교차로 비우는 중");
    } else if (signal.mode === "ALL_RED") {
      setText(this.phaseLabel, "전방향 정지 · 곧 신호 변경");
    } else {
      setText(this.phaseLabel, signal.activePhase === "NORTH_SOUTH" ? "남북 통행 중" : "동서 통행 중");
    }
  }

  private setActiveButton(phase: SignalPhase, ready: boolean): void {
    this.northSouthButton.disabled = !ready;
    this.eastWestButton.disabled = !ready;
    this.northSouthButton.classList.toggle("is-active", phase === "NORTH_SOUTH");
    this.eastWestButton.classList.toggle("is-active", phase === "EAST_WEST");
    this.northSouthButton.setAttribute("aria-pressed", String(phase === "NORTH_SOUTH"));
    this.eastWestButton.setAttribute("aria-pressed", String(phase === "EAST_WEST"));
  }
}
