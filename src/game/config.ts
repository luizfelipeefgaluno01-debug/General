import type { AmmoType, ControlScheme, EnemyKind, Obstacle, PlayerSlot, PowerUpKind } from '../types/game';

export const WORLD_W = 960;
export const WORLD_H = 540;
export const WALL = 16;

export const BOUNDS = Object.freeze({ minX: WALL, minY: WALL, maxX: WORLD_W - WALL, maxY: WORLD_H - WALL });

export const PLAYER = Object.freeze({
  radius: 14,
  speed: 150,
  maxHealth: 100,
  livesSolo: 3,
  livesVersus: 5,
  respawnTime: 2.2,
  invulnTime: 2,
  turnRate: 8
});

export interface AmmoConfig {
  readonly label: string;
  readonly damage: number;
  readonly speed: number;
  readonly cooldown: number;
  readonly radius: number;
  readonly splash: number;
  readonly life: number;
  readonly spread: number;
  readonly color: string;
}

export const AMMO: Readonly<Record<AmmoType, AmmoConfig>> = Object.freeze({
  standard: { label: 'PADRÃO', damage: 20, speed: 520, cooldown: 0.28, radius: 3, splash: 0, life: 1.4, spread: 0.02, color: '#ffd75e' },
  heavy: { label: 'PESADA', damage: 45, speed: 360, cooldown: 0.85, radius: 5, splash: 52, life: 1.6, spread: 0, color: '#ff8c2e' },
  rapid: { label: 'RAJADA', damage: 8, speed: 660, cooldown: 0.09, radius: 2, splash: 0, life: 0.9, spread: 0.09, color: '#fff3a8' }
});

export const AMMO_ORDER: readonly AmmoType[] = ['standard', 'heavy', 'rapid'];

export interface EnemyConfig {
  readonly label: string;
  readonly radius: number;
  readonly health: number;
  readonly speed: number;
  readonly fireRate: number;
  readonly range: number;
  readonly preferredDist: number;
  readonly score: number;
  readonly bulletDamage: number;
  readonly bulletSpeed: number;
  readonly dropChance: number;
}

export const ENEMIES: Readonly<Record<EnemyKind, EnemyConfig>> = Object.freeze({
  soldier: { label: 'SOLDADO', radius: 8, health: 30, speed: 72, fireRate: 1.5, range: 250, preferredDist: 120, score: 100, bulletDamage: 6, bulletSpeed: 260, dropChance: 0.08 },
  lightTank: { label: 'TANQUE LEVE', radius: 15, health: 120, speed: 56, fireRate: 1.9, range: 380, preferredDist: 260, score: 250, bulletDamage: 14, bulletSpeed: 300, dropChance: 0.3 },
  artillery: { label: 'ARTILHARIA', radius: 17, health: 170, speed: 28, fireRate: 4.4, range: 1200, preferredDist: 420, score: 400, bulletDamage: 30, bulletSpeed: 0, dropChance: 0.5 }
});

export const POWERUPS: Readonly<Record<PowerUpKind, { label: string; duration: number; color: string }>> = Object.freeze({
  shield: { label: 'ESCUDO', duration: 8, color: '#5ee1ff' },
  doubleShot: { label: 'TIRO DUPLO', duration: 10, color: '#ffd75e' },
  repair: { label: 'REPARO', duration: 0, color: '#7dff6a' }
});

export const POWERUP_ORDER: readonly PowerUpKind[] = ['shield', 'doubleShot', 'repair'];

/** Esquemas de controle sem sobreposição de teclas (baseados em KeyboardEvent.code). */
export const CONTROLS: Readonly<Record<PlayerSlot, ControlScheme>> = Object.freeze({
  1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], fire: ['Space'], switchAmmo: ['KeyQ'] },
  2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    fire: ['Enter', 'NumpadEnter', 'Numpad0'], switchAmmo: ['ShiftRight', 'Numpad1']
  }
});

/** No modo solo, o jogador 1 também pode usar as setas. */
export const SOLO_CONTROLS: ControlScheme = Object.freeze({
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  fire: ['Space'], switchAmmo: ['KeyQ', 'ShiftRight']
});

export const PAUSE_KEYS: readonly string[] = ['Escape', 'KeyP'];

export const PLAYER_COLORS: Readonly<Record<PlayerSlot, string>> = Object.freeze({ 1: '#8fa352', 2: '#6b9cbf' });

export const OBSTACLES: readonly Obstacle[] = Object.freeze([
  { x: 450, y: 240, w: 60, h: 60, kind: 'bunker' },
  { x: 190, y: 116, w: 128, h: 22, kind: 'sandbag' },
  { x: 642, y: 116, w: 128, h: 22, kind: 'sandbag' },
  { x: 190, y: 402, w: 128, h: 22, kind: 'sandbag' },
  { x: 642, y: 402, w: 128, h: 22, kind: 'sandbag' },
  { x: 252, y: 252, w: 32, h: 32, kind: 'crate' },
  { x: 676, y: 252, w: 32, h: 32, kind: 'crate' },
  { x: 464, y: 92, w: 32, h: 32, kind: 'crate' }
]);

export const POOL_SIZES = Object.freeze({
  enemies: 64,
  bullets: 320,
  shells: 24,
  particles: 700,
  explosions: 48,
  powerups: 8,
  texts: 32
});
