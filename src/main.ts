import "./styles.css";
import { GameApp } from "./app/GameApp";

const app = new GameApp();

app.initialize().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  const startButton = document.getElementById("start-button");
  if (startButton instanceof HTMLButtonElement) {
    startButton.disabled = true;
    startButton.textContent = `게임을 시작할 수 없습니다: ${message}`;
  }
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy());
}

