/**
 * Efeitos sonoros 8-bit sintetizados com WebAudio (sem arquivos externos).
 */
import { logger } from '../security/logger';

export type SoundName = 'shoot' | 'heavy' | 'rapid' | 'enemyShoot' | 'explosion' | 'hit' | 'powerup' | 'wave' | 'gameover' | 'select';

export interface SoundSystem {
  play: (name: SoundName) => void;
  destroy: () => void;
}

export function createSound(enabled: boolean): SoundSystem {
  if (!enabled || typeof window.AudioContext !== 'function') {
    return { play: () => undefined, destroy: () => undefined };
  }
  let ctx: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let lastPlay = 0;

  const ensure = (): AudioContext | null => {
    try {
      if (ctx === null) {
        ctx = new AudioContext();
        const len = Math.floor(ctx.sampleRate * 0.5);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') void ctx.resume();
      return ctx;
    } catch (err) {
      logger.warn('audio', 'Áudio indisponível', err);
      return null;
    }
  };

  const tone = (type: OscillatorType, from: number, to: number, dur: number, vol: number): void => {
    const c = ensure();
    if (c === null) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur);
  };

  const burst = (dur: number, vol: number, freq: number): void => {
    const c = ensure();
    if (c === null || noise === null) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noise;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
    src.stop(t + dur);
  };

  return {
    play: (name: SoundName): void => {
      const now = performance.now();
      if ((name === 'rapid' || name === 'enemyShoot') && now - lastPlay < 40) return;
      lastPlay = now;
      switch (name) {
        case 'shoot': tone('square', 520, 180, 0.09, 0.05); break;
        case 'rapid': tone('square', 900, 400, 0.04, 0.025); break;
        case 'heavy': tone('sawtooth', 220, 50, 0.22, 0.07); burst(0.15, 0.08, 1200); break;
        case 'enemyShoot': tone('triangle', 400, 160, 0.08, 0.035); break;
        case 'explosion': burst(0.45, 0.2, 2200); tone('sine', 120, 30, 0.35, 0.12); break;
        case 'hit': tone('square', 160, 60, 0.1, 0.06); break;
        case 'powerup': tone('square', 440, 880, 0.08, 0.05); setTimeout(() => tone('square', 660, 1320, 0.12, 0.05), 80); break;
        case 'wave': tone('square', 330, 330, 0.12, 0.05); setTimeout(() => tone('square', 495, 495, 0.2, 0.05), 140); break;
        case 'gameover': tone('square', 392, 98, 1.0, 0.07); break;
        case 'select': tone('square', 700, 700, 0.05, 0.04); break;
      }
    },
    destroy: (): void => {
      if (ctx !== null) void ctx.close().catch(() => undefined);
      ctx = null;
    }
  };
}
