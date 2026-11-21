/**
 * Web Audio API Sound Synthesizer for The Grand Chess Room
 * High-fidelity procedural audio designed for responsive, zero-latency feedback.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  // TACTILE PIECE SELECT
  public playSelect() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // NORMAL MOVE (Rich wooden thud)
  public playMove() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Sub thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    // Click snap
    const noiseBuffer = this.createNoiseBuffer(0.03);
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2 * this.volume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // CAPTURE (Weighty double-impact clack)
  public playCapture() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.playMove();

    // Secondary sharper crack 25ms later
    setTimeout(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.07);

      gain.gain.setValueAtTime(0.4 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }, 25);
  }

  // CHECK (Crisp brass / warning chime)
  public playCheck() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [659.25, 987.77].forEach((freq, i) => { // E5, B5
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);

      gain.gain.setValueAtTime(0.25 * this.volume, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + i * 0.04);
      osc.stop(now + 0.5);
    });
  }

  // CHECKMATE (Grand dramatic resonant chord)
  public playCheckmate() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Dramatic minor chord: D3, F3, A3, D4
    const freqs = [146.83, 174.61, 220.00, 293.66];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx === 0 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 1.3);
    });
  }

  // CASTLING (Two rhythmic placements)
  public playCastling() {
    this.playMove();
    setTimeout(() => this.playMove(), 110);
  }

  // PAWN PROMOTION (Ascending chime flourish)
  public playPromotion() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      const start = now + idx * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2 * this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  // BUTTON INTERACTION (Crisp UI click)
  public playClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.12 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // VICTORY FANFARE
  public playVictory() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.50, d: 0.45 } // C6
    ];

    let offset = 0;
    notes.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, now + offset);

      gain.gain.setValueAtTime(0.25 * this.volume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + offset);
      osc.stop(now + offset + note.d + 0.05);

      offset += 0.13;
    });
  }

  // DEFEAT MELODY
  public playDefeat() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [
      { f: 392.00, d: 0.2 }, // G4
      { f: 349.23, d: 0.2 }, // F4
      { f: 329.63, d: 0.2 }, // E4
      { f: 293.66, d: 0.5 }  // D4
    ];

    let offset = 0;
    notes.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now + offset);

      gain.gain.setValueAtTime(0.2 * this.volume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + offset);
      osc.stop(now + offset + note.d + 0.05);

      offset += 0.22;
    });
  }

  // DRAW BELL
  public playDraw() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  // CLOCK TICK
  public playTick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.04 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const bufferSize = this.ctx!.sampleRate * duration;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const soundManager = new SoundManager();

