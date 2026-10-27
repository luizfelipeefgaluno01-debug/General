import type { ReactNode } from 'react';
import { useGameActions, useGameStore } from '../store/GameStoreContext';
import { useMenuNavigation } from '../hooks/useMenuNavigation';
import { formatScore, formatTime } from './format';

export function GameOverScreen(): ReactNode {
  const stats = useGameStore((s) => s.stats);
  const actions = useGameActions();
  const nav = useMenuNavigation('gameover');
  if (stats === null) return null;
  const versus = stats.mode === 'versus';

  return (
    <div className="overlay gameover-overlay" role="dialog" aria-modal="true" aria-label="Fim de jogo">
      <div className="scanlines" aria-hidden="true" />
      <h2 className="gameover-title blink-hard">GAME OVER</h2>
      <p className="gameover-sub">
        {versus && stats.winner !== null ? `VITÓRIA DE ${stats.winner}` : 'SUA TROPA FOI DERROTADA'}
      </p>

      <dl className="stats-grid">
        <div><dt>PONTUAÇÃO FINAL</dt><dd className="gold">{formatScore(stats.score)}</dd></div>
        <div><dt>TEMPO DE PARTIDA</dt><dd>{formatTime(stats.elapsedSeconds)}</dd></div>
        {versus ? (
          <div><dt>ABATES TOTAIS</dt><dd>{stats.players.reduce((a, p) => a + p.kills, 0)}</dd></div>
        ) : (
          <div><dt>INIMIGOS DERROTADOS</dt><dd>{stats.enemiesDefeated}</dd></div>
        )}
        {!versus && <div><dt>ONDA ALCANÇADA</dt><dd>{stats.wave}</dd></div>}
      </dl>

      {stats.players.length > 1 && (
        <table className="score-table">
          <thead>
            <tr><th>SOLDADO</th><th>PONTOS</th><th>ABATES</th></tr>
          </thead>
          <tbody>
            {stats.players.map((p, i) => (
              <tr key={i} className={`row-p${i + 1}`}>
                <td>{p.name}</td>
                <td>{formatScore(p.score)}</td>
                <td>{p.kills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="menu-panel compact">
        <button type="button" className="menu-item" ref={nav.register(0)} onMouseEnter={nav.hover(0)} onClick={actions.restart}>
          <span className="menu-cursor" aria-hidden="true">▶</span>
          <span className="menu-label">REINICIAR BATALHA</span>
        </button>
        <button type="button" className="menu-item" ref={nav.register(1)} onMouseEnter={nav.hover(1)} onClick={actions.backToMenu}>
          <span className="menu-cursor" aria-hidden="true">▶</span>
          <span className="menu-label">MENU PRINCIPAL</span>
        </button>
      </div>
    </div>
  );
}
