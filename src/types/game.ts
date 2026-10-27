/**
 * Tipos centrais do jogo "General da Guerra".
 * Todas as entidades do motor são objetos mutáveis reaproveitados (Object Pooling),
 * por isso possuem a flag `active`.
 */

export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'single' | 'coop' | 'versus';
export type AimMode = 'mouse' | 'keyboard';
export type PlayerSlot = 1 | 2;
export type AmmoType = 'standard' | 'heavy' | 'rapid';
export type EnemyKind = 'soldier' | 'lightTank' | 'artillery';
export type PowerUpKind = 'shield' | 'doubleShot' | 'repair';
export type Team = 'player' | 'enemy';

export interface Vec2 {
  x: number;
  y: number;
}

/** Base de toda entidade física renderizada no Canvas. */
export interface Entity extends Vec2 {
  active: boolean;
  vx: number;
  vy: number;
  radius: number;
}

export interface ControlScheme {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  fire: readonly string[];
  switchAmmo: readonly string[];
}

export interface Player extends Entity {
  slot: PlayerSlot;
  name: string;
  color: string;
  bodyAngle: number;
  turretAngle: number;
  health: number;
  maxHealth: number;
  lives: number;
  ammo: AmmoType;
  cooldown: number;
  shieldTime: number;
  doubleShotTime: number;
  invulnTime: number;
  respawnTimer: number;
  alive: boolean;
  kills: number;
  score: number;
  hitFlash: number;
  spawnX: number;
  spawnY: number;
}

export interface Projectile extends Entity {
  team: Team;
  /** Slot do jogador que disparou (0 = inimigo). */
  owner: 0 | PlayerSlot;
  damage: number;
  life: number;
  ammo: AmmoType | 'enemy';
  splash: number;
}

/** Projétil balístico de artilharia: cai em um ponto-alvo após um tempo de voo. */
export interface ArtilleryShell {
  active: boolean;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  timer: number;
  flightTime: number;
  damage: number;
  splash: number;
}

export interface Enemy extends Entity {
  kind: EnemyKind;
  health: number;
  maxHealth: number;
  speed: number;
  cooldown: number;
  fireRate: number;
  range: number;
  preferredDist: number;
  angle: number;
  /** Índice do líder de formação no pool (-1 = sem líder). */
  leader: number;
  offsetX: number;
  offsetY: number;
  strafeDir: 1 | -1;
  scoreValue: number;
  hitFlash: number;
}

export interface PowerUp extends Entity {
  kind: PowerUpKind;
  life: number;
  bob: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Explosion {
  active: boolean;
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'sandbag' | 'bunker' | 'crate';
}

export interface GameSettings {
  mode: GameMode;
  p1Name: string;
  p2Name: string;
  aimMode: AimMode;
  sound: boolean;
}

export interface PlayerHud {
  slot: PlayerSlot;
  name: string;
  color: string;
  health: number;
  maxHealth: number;
  lives: number;
  ammo: AmmoType;
  shield: number;
  doubleShot: number;
  alive: boolean;
  score: number;
  kills: number;
}

export interface HudState {
  players: readonly PlayerHud[];
  wave: number;
  score: number;
  enemiesLeft: number;
  elapsed: number;
  banner: string;
}

export interface PlayerStats {
  name: string;
  score: number;
  kills: number;
}

export interface GameStats {
  mode: GameMode;
  score: number;
  elapsedSeconds: number;
  enemiesDefeated: number;
  wave: number;
  winner: string | null;
  players: readonly PlayerStats[];
}

export interface GameStoreState {
  phase: GamePhase;
  settings: GameSettings;
  hud: HudState | null;
  stats: GameStats | null;
  /** Incrementado a cada nova partida para recriar o motor. */
  runId: number;
}
