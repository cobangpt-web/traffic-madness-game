export type SoundName = "select" | "switch" | "pass" | "collision" | "finish";

const SOUND_PATHS: Readonly<Record<SoundName, string>> = {
  select: "/assets/sounds/sfx_select.ogg",
  switch: "/assets/sounds/sfx_magic.ogg",
  pass: "/assets/sounds/sfx_coin.ogg",
  collision: "/assets/sounds/sfx_hurt.ogg",
  finish: "/assets/sounds/sfx_bump.ogg",
};

export class AudioManager {
  private muted = false;
  private readonly sounds = new Map<SoundName, HTMLAudioElement>();
  private audioContext: AudioContext | null = null;
  private sirenCooldownUntil = 0;

  constructor() {
    for (const [name, source] of Object.entries(SOUND_PATHS) as [SoundName, string][]) {
      const audio = new Audio(source);
      audio.preload = "auto";
      audio.volume = name === "collision" ? 0.55 : 0.35;
      this.sounds.set(name, audio);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  activate(): void {
    if (this.muted) return;
    const context = this.ensureAudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const source = this.sounds.get(name);
    if (!source) return;
    const sound = source.cloneNode(true) as HTMLAudioElement;
    sound.volume = source.volume;
    void sound.play().catch(() => undefined);
  }

  playSiren(): void {
    if (this.muted || performance.now() < this.sirenCooldownUntil) return;
    this.sirenCooldownUntil = performance.now() + 1_200;
    const context = this.ensureAudioContext();
    const play = (): void => this.scheduleSiren(context);
    if (context.state === "suspended") void context.resume().then(play).catch(() => undefined);
    else play();
  }

  private ensureAudioContext(): AudioContext {
    this.audioContext ??= new AudioContext();
    return this.audioContext;
  }

  private scheduleSiren(context: AudioContext): void {
    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(690, start);
    oscillator.frequency.linearRampToValueAtTime(980, start + 0.22);
    oscillator.frequency.linearRampToValueAtTime(690, start + 0.44);
    oscillator.frequency.linearRampToValueAtTime(980, start + 0.66);
    oscillator.frequency.linearRampToValueAtTime(690, start + 0.88);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.085, start + 0.035);
    gain.gain.setValueAtTime(0.085, start + 0.78);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.92);
  }
}
