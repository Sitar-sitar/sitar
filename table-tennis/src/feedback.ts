export interface FeedbackFlags {
  sound: boolean;
  vibe: boolean;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class Feedback {
  private audioContext: AudioContext | null = null;

  public constructor(
    private readonly getFlags: () => FeedbackFlags,
    private readonly random: () => number = Math.random,
  ) {}

  public initializeAudio(): void {
    const AudioContextConstructor =
      window.AudioContext ?? window.webkitAudioContext;
    if (!this.audioContext && AudioContextConstructor) {
      try {
        this.audioContext = new AudioContextConstructor();
      } catch {
        this.audioContext = null;
      }
    }
    if (this.audioContext?.state === "suspended") {
      void this.audioContext.resume().catch(() => undefined);
    }
  }

  public hit(power: number): void {
    this.blip(900 + power * 700, 0.05, null, 0.3, true);
    this.blip(320 + power * 260, 0.05, "square", 0.08);
    this.buzz(10);
  }

  public bounce(): void {
    this.blip(1500, 0.035, null, 0.16, true);
  }

  public net(): void {
    this.blip(180, 0.13, "sine", 0.2);
    this.buzz(24);
  }

  public win(): void {
    this.blip(660, 0.09, "square", 0.14);
    window.setTimeout(() => {
      this.blip(990, 0.16, "square", 0.14);
    }, 90);
    this.buzz(34);
  }

  public lose(): void {
    this.blip(300, 0.2, "sine", 0.15);
    this.buzz([18, 60, 18]);
  }

  public buzz(pattern: VibratePattern): void {
    if (!this.getFlags().vibe || !navigator.vibrate) {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration is optional feedback.
    }
  }

  private blip(
    frequency: number,
    duration: number,
    oscillatorType: OscillatorType | null,
    gainValue: number,
    noise = false,
  ): void {
    const context = this.audioContext;
    if (!this.getFlags().sound || !context) {
      return;
    }

    const time = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(gainValue, time);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + duration);
    gain.connect(context.destination);

    if (noise) {
      const source = context.createBufferSource();
      const length = Math.ceil(context.sampleRate * duration);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) {
        data[index] =
          (this.random() * 2 - 1) * (1 - index / Math.max(1, length));
      }
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = 1.4;
      source.connect(filter);
      filter.connect(gain);
      source.start(time);
      source.stop(time + duration);
      return;
    }

    const oscillator = context.createOscillator();
    oscillator.type = oscillatorType ?? "triangle";
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.6,
      time + duration,
    );
    oscillator.connect(gain);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
}
