/**
 * Store global customizada (sem dependências), baseada em closure.
 * O estado vive em uma variável privada; o mundo externo só recebe snapshots congelados
 * e só pode alterá-lo através das ações expostas — nada fica pendurado em `window`.
 */
import type { GameSettings, GameStats, GameStoreState, HudState } from '../types/game';
import { loadSettings, saveSettings, validateSettings } from '../security/sanitize';
import { logger } from '../security/logger';

type Listener = () => void;

export interface GameStore {
  getState: () => Readonly<GameStoreState>;
  subscribe: (listener: Listener) => () => void;
  actions: Readonly<{
    updateSettings: (patch: Partial<GameSettings>) => void;
    startGame: (patch?: Partial<GameSettings>) => void;
    restart: () => void;
    togglePause: () => void;
    setPaused: (paused: boolean) => void;
    updateHud: (hud: HudState) => void;
    endGame: (stats: GameStats) => void;
    backToMenu: () => void;
  }>;
}

function freezeDeep<T>(obj: T): T {
  if (obj !== null && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) freezeDeep(value);
  }
  return obj;
}

export function createGameStore(): GameStore {
  let state: GameStoreState = freezeDeep({
    phase: 'menu',
    settings: loadSettings(),
    hud: null,
    stats: null,
    runId: 0
  });
  const listeners = new Set<Listener>();

  const setState = (next: Partial<GameStoreState>): void => {
    state = freezeDeep({ ...state, ...next });
    listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        logger.error('store', 'Listener falhou', err);
      }
    });
  };

  const actions = Object.freeze({
    updateSettings: (patch: Partial<GameSettings>): void => {
      const settings = validateSettings({ ...state.settings, ...patch });
      saveSettings(settings);
      setState({ settings });
    },
    startGame: (patch: Partial<GameSettings> = {}): void => {
      const settings = validateSettings({ ...state.settings, ...patch });
      saveSettings(settings);
      setState({ settings, phase: 'playing', hud: null, stats: null, runId: state.runId + 1 });
    },
    restart: (): void => {
      setState({ phase: 'playing', hud: null, stats: null, runId: state.runId + 1 });
    },
    togglePause: (): void => {
      if (state.phase === 'playing') setState({ phase: 'paused' });
      else if (state.phase === 'paused') setState({ phase: 'playing' });
    },
    setPaused: (paused: boolean): void => {
      if (paused && state.phase === 'playing') setState({ phase: 'paused' });
      if (!paused && state.phase === 'paused') setState({ phase: 'playing' });
    },
    updateHud: (hud: HudState): void => {
      if (state.phase === 'playing' || state.phase === 'paused') setState({ hud });
    },
    endGame: (stats: GameStats): void => {
      if (state.phase === 'gameover') return;
      setState({ phase: 'gameover', stats });
    },
    backToMenu: (): void => {
      setState({ phase: 'menu', hud: null, stats: null });
    }
  });

  return Object.freeze({
    getState: (): Readonly<GameStoreState> => state,
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions
  });
}
