import type { ReactNode } from 'react';
import { useGameStore } from './store/GameStoreContext';
import { MainMenu } from './components/MainMenu';
import { GameCanvas } from './components/GameCanvas';
import { Hud } from './components/Hud';
import { PauseOverlay } from './components/PauseOverlay';
import { GameOverScreen } from './components/GameOverScreen';

export function App(): ReactNode {
  const phase = useGameStore((s) => s.phase);
  return (
    <main className="app">
      <div className="stage">
        {phase === 'menu' ? (
          <MainMenu />
        ) : (
          <>
            <GameCanvas />
            {phase !== 'gameover' && <Hud />}
            {phase === 'paused' && <PauseOverlay />}
            {phase === 'gameover' && <GameOverScreen />}
          </>
        )}
        <div className="crt" aria-hidden="true" />
      </div>
    </main>
  );
}
