/**
 * Loop principal baseado em requestAnimationFrame com deltaTime.
 * O delta é limitado para evitar "saltos" após trocar de aba ou travar o navegador.
 */
import { logger } from '../security/logger';

export interface GameLoop {
  start: () => void;
  stop: () => void;
  readonly running: boolean;
}

const MAX_DELTA = 1 / 20; // 50 ms

export function createGameLoop(update: (dt: number) => void, render: () => void): GameLoop {
  let frameId = 0;
  let last = 0;
  let running = false;
  let failures = 0;

  const frame = (now: number): void => {
    if (!running) return;
    const raw = (now - last) / 1000;
    last = now;
    const dt = raw > 0 && raw < 1 ? Math.min(raw, MAX_DELTA) : 1 / 60;
    try {
      update(dt);
      render();
      failures = 0;
    } catch (err) {
      failures++;
      logger.error('loop', 'Falha no frame', err);
      if (failures > 30) {
        running = false;
        logger.error('loop', 'Loop interrompido após falhas consecutivas');
        return;
      }
    }
    frameId = requestAnimationFrame(frame);
  };

  return {
    start: (): void => {
      if (running) return;
      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(frame);
    },
    stop: (): void => {
      running = false;
      cancelAnimationFrame(frameId);
    },
    get running(): boolean {
      return running;
    }
  };
}
