import type { ReactNode } from 'react';
import { useGameStore } from '../store/GameStoreContext';
import { AMMO, POWERUPS } from '../game/config';
import type { PlayerHud } from '../types/game';
import { formatScore, formatTime } from './format';

function PlayerPanel({ p, align }: { p: PlayerHud; align: 'left' | 'right' }): ReactNode {
  const ratio = p.maxHealth > 0 ? Math.max(0, Math.min(1, p.health / p.maxHealth)) : 0;
  return (
    <div className={`hud-player hud-${align} ${p.alive ? '' : 'hud-dead'}`} style={{ borderColor: p.color }}>
      <div className="hud-row">
        <span className="hud-name" style={{ color: p.color }}>P{p.slot} {p.name}</span>
        <span className="hud-lives" aria-label={`${p.lives} vidas`}>
          {Array.from({ length: Math.max(0, Math.min(9, p.lives)) }, (_, i) => (
            <span key={i} className="life-icon" />
          ))}
        </span>
      </div>
      <div className="hp-bar" role="progressbar" aria-valuenow={p.health} aria-valuemin={0} aria-valuemax={p.maxHealth}>
        <div className={`hp-fill ${ratio < 0.35 ? 'hp-low' : ''}`} style={{ width: `${Math.floor(ratio * 100)}%` }} />
      </div>
      <div className="hud-row hud-small">
        <span>
          MUN: <b style={{ color: AMMO[p.ammo].color }}>{AMMO[p.ammo].label}</b>
        </span>
        <span>{p.alive ? `PTS ${formatScore(p.score)}` : 'REAGRUPANDO...'}</span>
      </div>
      <div className="hud-buffs">
        {p.shield > 0 && (
          <div className="buff" style={{ color: POWERUPS.shield.color }}>
            <span>ESCUDO</span>
            <div className="buff-bar"><div style={{ width: `${Math.floor((p.shield / POWERUPS.shield.duration) * 100)}%`, background: POWERUPS.shield.color }} /></div>
          </div>
        )}
        {p.doubleShot > 0 && (
          <div className="buff" style={{ color: POWERUPS.doubleShot.color }}>
            <span>TIRO DUPLO</span>
            <div className="buff-bar"><div style={{ width: `${Math.floor((p.doubleShot / POWERUPS.doubleShot.duration) * 100)}%`, background: POWERUPS.doubleShot.color }} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Hud(): ReactNode {
  const hud = useGameStore((s) => s.hud);
  const mode = useGameStore((s) => s.settings.mode);
  if (hud === null) return null;
  const [p1, p2] = hud.players;
  return (
    <div className="hud" aria-live="polite">
      <div className="hud-top">
        {p1 !== undefined && <PlayerPanel p={p1} align="left" />}
        <div className="hud-center">
          <div className="hud-score">{formatScore(hud.score)}</div>
          <div className="hud-meta">
            {mode === 'versus' ? <span>VERSUS</span> : <span>ONDA {hud.wave}</span>}
            <span>{formatTime(hud.elapsed)}</span>
            {mode !== 'versus' && <span>INIMIGOS {hud.enemiesLeft}</span>}
          </div>
        </div>
        {p2 !== undefined ? <PlayerPanel p={p2} align="right" /> : <div className="hud-spacer" />}
      </div>
      {hud.banner !== '' && <div className="hud-banner">{hud.banner}</div>}
    </div>
  );
}
