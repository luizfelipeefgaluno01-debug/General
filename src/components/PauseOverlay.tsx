import type { ReactNode } from 'react';
import { useGameActions } from '../store/GameStoreContext';
import { useMenuNavigation } from '../hooks/useMenuNavigation';

export function PauseOverlay(): ReactNode {
  const actions = useGameActions();
  const nav = useMenuNavigation('pause');
  return (
    <div className="overlay pause-overlay" role="dialog" aria-modal="true" aria-label="Jogo pausado">
      <h2 className="overlay-title">PAUSADO</h2>
      <div className="menu-panel compact">
        <button type="button" className="menu-item" ref={nav.register(0)} onMouseEnter={nav.hover(0)} onClick={() => actions.setPaused(false)}>
          <span className="menu-cursor" aria-hidden="true">▶</span>
          <span className="menu-label">CONTINUAR</span>
        </button>
        <button type="button" className="menu-item" ref={nav.register(1)} onMouseEnter={nav.hover(1)} onClick={actions.restart}>
          <span className="menu-cursor" aria-hidden="true">▶</span>
          <span className="menu-label">REINICIAR BATALHA</span>
        </button>
        <button type="button" className="menu-item" ref={nav.register(2)} onMouseEnter={nav.hover(2)} onClick={actions.backToMenu}>
          <span className="menu-cursor" aria-hidden="true">▶</span>
          <span className="menu-label">MENU PRINCIPAL</span>
        </button>
      </div>
      <p className="overlay-hint">ESC / P PARA CONTINUAR</p>
    </div>
  );
}
