import { useState, type ReactNode } from 'react';
import { useGameActions, useGameStore } from '../store/GameStoreContext';
import { useMenuNavigation } from '../hooks/useMenuNavigation';
import { sanitizeInput } from '../security/sanitize';
import { ControlsTable } from './ControlsTable';

type Screen = 'root' | 'multi' | 'options';

export function MainMenu(): ReactNode {
  const [screen, setScreen] = useState<Screen>('root');
  const settings = useGameStore((s) => s.settings);
  const actions = useGameActions();
  const nav = useMenuNavigation(screen);
  const [p1, setP1] = useState(settings.p1Name);
  const [p2, setP2] = useState(settings.p2Name);

  const commitNames = (): void => actions.updateSettings({ p1Name: p1, p2Name: p2 });

  const item = (index: number, label: string, onClick: () => void, hint?: string): ReactNode => (
    <button
      type="button"
      className="menu-item"
      ref={nav.register(index)}
      onMouseEnter={nav.hover(index)}
      onClick={onClick}
    >
      <span className="menu-cursor" aria-hidden="true">▶</span>
      <span className="menu-label">{label}</span>
      {hint !== undefined && <span className="menu-hint">{hint}</span>}
    </button>
  );

  return (
    <div className="screen menu-screen">
      <div className="menu-bg" aria-hidden="true">
        <div className="menu-sun" />
        <div className="menu-hills" />
        <div className="menu-tank menu-tank-a" />
        <div className="menu-tank menu-tank-b" />
      </div>

      {screen !== 'options' && (
      <header className="title-block">
        <div className="title-star" aria-hidden="true">★</div>
        <h1 className="game-title">
          <span>GENERAL</span>
          <span className="title-small">DA</span>
          <span>GUERRA</span>
        </h1>
        <p className="subtitle">COMBATE TÁTICO DE BLINDADOS</p>
      </header>
      )}

      <nav className={`menu-panel ${screen === 'options' ? 'options-panel' : ''}`} aria-label="Menu principal">
        {screen === 'root' && (
          <>
            {item(0, 'PLAYER', () => actions.startGame({ mode: 'single', p1Name: p1 }), '1 JOGADOR')}
            {item(1, 'MULTIPLAYER', () => setScreen('multi'), 'LOCAL')}
            {item(2, 'CONTROLES & OPÇÕES', () => setScreen('options'))}
          </>
        )}

        {screen === 'multi' && (
          <>
            <p className="panel-title">MULTIPLAYER LOCAL</p>
            {item(0, 'CO-OP', () => actions.startGame({ mode: 'coop', p1Name: p1, p2Name: p2 }), 'P1 + P2 VS IA')}
            {item(1, 'VERSUS', () => actions.startGame({ mode: 'versus', p1Name: p1, p2Name: p2 }), 'P1 X P2')}
            {item(2, 'VOLTAR', () => setScreen('root'))}
          </>
        )}

        {screen === 'options' && (
          <>
            <p className="panel-title">CONTROLES & OPÇÕES</p>
            <label className="field">
              <span>NOME P1</span>
              <input
                ref={nav.register(0)}
                onMouseEnter={nav.hover(0)}
                value={p1}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setP1(sanitizeInput(e.target.value, { maxLength: 12 }).toUpperCase())}
                onBlur={commitNames}
              />
            </label>
            <label className="field">
              <span>NOME P2</span>
              <input
                ref={nav.register(1)}
                onMouseEnter={nav.hover(1)}
                value={p2}
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setP2(sanitizeInput(e.target.value, { maxLength: 12 }).toUpperCase())}
                onBlur={commitNames}
              />
            </label>
            {item(2, `MIRA P1: ${settings.aimMode === 'mouse' ? 'MOUSE' : 'TECLADO'}`, () =>
              actions.updateSettings({ aimMode: settings.aimMode === 'mouse' ? 'keyboard' : 'mouse' })
            )}
            {item(3, `SOM: ${settings.sound ? 'LIGADO' : 'DESLIGADO'}`, () => actions.updateSettings({ sound: !settings.sound }))}
            {item(4, 'VOLTAR', () => {
              commitNames();
              setScreen('root');
            })}
            <ControlsTable />
          </>
        )}
      </nav>

      <footer className="menu-footer">
        <span className="blink">↑ ↓ NAVEGAR · ENTER SELECIONAR</span>
        <span>© 2026 GENERAL DA GUERRA</span>
      </footer>
    </div>
  );
}
