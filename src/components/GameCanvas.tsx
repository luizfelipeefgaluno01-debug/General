import { useEffect, useRef, type ReactNode } from 'react';
import { createGame, type GameHandle } from '../game/createGame';
import { useGameActions, useGameStoreApi, useGameStore } from '../store/GameStoreContext';
import { logger } from '../security/logger';

export function GameCanvas(): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const store = useGameStoreApi();
  const actions = useGameActions();
  const runId = useGameStore((s) => s.runId);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    let game: GameHandle | null = null;
    try {
      game = createGame(canvas, store.getState().settings, {
        onHud: actions.updateHud,
        onGameOver: actions.endGame,
        onPauseToggle: actions.togglePause
      });
      handleRef.current = game;
      game.start();
      canvas.focus();
    } catch (err) {
      logger.error('canvas', 'Não foi possível iniciar o motor', err);
      actions.backToMenu();
    }
    const onVisibility = (): void => {
      if (document.hidden) actions.setPaused(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      game?.destroy();
      handleRef.current = null;
    };
  }, [runId, store, actions]);

  useEffect(() => {
    handleRef.current?.setPaused(phase === 'paused');
  }, [phase]);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      tabIndex={-1}
      aria-label="Campo de batalha do General da Guerra"
    />
  );
}
