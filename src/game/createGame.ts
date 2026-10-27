/**
 * Motor de jogo do "General da Guerra".
 *
 * Todo o estado crítico (pontuação, vida, loop) vive dentro da closure de `createGame`.
 * Nada é anexado ao `window`, então não pode ser manipulado pelo console do navegador.
 * O mundo externo só recebe: um handle com start/destroy/setPaused e callbacks com
 * cópias (snapshots) do HUD e das estatísticas finais.
 */
import type {
  AmmoType,
  ArtilleryShell,
  ControlScheme,
  Enemy,
  EnemyKind,
  Explosion,
  GameSettings,
  GameStats,
  HudState,
  Obstacle,
  Particle,
  Player,
  PlayerSlot,
  PowerUp,
  PowerUpKind,
  Projectile,
  Team
} from '../types/game';
import {
  AMMO,
  AMMO_ORDER,
  BOUNDS,
  CONTROLS,
  ENEMIES,
  OBSTACLES,
  PAUSE_KEYS,
  PLAYER,
  PLAYER_COLORS,
  POOL_SIZES,
  POWERUPS,
  POWERUP_ORDER,
  SOLO_CONTROLS,
  WALL,
  WORLD_H,
  WORLD_W
} from './config';
import { ObjectPool } from '../engine/ObjectPool';
import { createGameLoop } from '../engine/GameLoop';
import { createInput } from '../engine/Input';
import { createSound } from '../engine/Audio';
import { createBackground, createSprites, drawBar, drawSprite } from '../engine/Renderer';
import { clamp, enforceEntityBounds, safeNumber } from '../security/guards';
import { sanitizeName, validateSettings } from '../security/sanitize';
import { logger } from '../security/logger';

export interface GameCallbacks {
  onHud: (hud: HudState) => void;
  onGameOver: (stats: GameStats) => void;
  onPauseToggle: () => void;
}

export interface GameHandle {
  start: () => void;
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

interface FloatText {
  active: boolean;
  x: number;
  y: number;
  life: number;
  text: string;
  color: string;
}

interface SpawnGroup {
  kind: EnemyKind;
  count: number;
}

const TAU = Math.PI * 2;
const HUD_INTERVAL = 0.1;
const SCORE_TEXT: Readonly<Record<EnemyKind, string>> = { soldier: '+100', lightTank: '+250', artillery: '+400' };

function wrapAngle(a: number): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * clamp(t, 0, 1);
}

/** Resolve colisão círculo x retângulo empurrando a entidade para fora. */
function pushOutOfRect(e: { x: number; y: number; radius: number }, o: Obstacle): boolean {
  const nx = clamp(e.x, o.x, o.x + o.w);
  const ny = clamp(e.y, o.y, o.y + o.h);
  const dx = e.x - nx;
  const dy = e.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= e.radius * e.radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = e.radius - d;
    e.x += (dx / d) * push;
    e.y += (dy / d) * push;
  } else {
    // centro dentro do retângulo: sai pelo lado mais próximo
    const left = e.x - o.x;
    const right = o.x + o.w - e.x;
    const top = e.y - o.y;
    const bottom = o.y + o.h - e.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) e.x = o.x - e.radius;
    else if (m === right) e.x = o.x + o.w + e.radius;
    else if (m === top) e.y = o.y - e.radius;
    else e.y = o.y + o.h + e.radius;
  }
  return true;
}

function pointInObstacle(x: number, y: number, pad: number): boolean {
  for (const o of OBSTACLES) {
    if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
  }
  return false;
}

export function createGame(canvas: HTMLCanvasElement, rawSettings: GameSettings, callbacks: GameCallbacks): GameHandle {
  const settings: Readonly<GameSettings> = Object.freeze(validateSettings(rawSettings));
  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (maybeCtx === null) throw new Error('Canvas 2D indisponível');
  const ctx: CanvasRenderingContext2D = maybeCtx;
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  ctx.imageSmoothingEnabled = false;

  const input = createInput(canvas, WORLD_W, WORLD_H);
  const sound = createSound(settings.sound);
  const sprites = createSprites();
  const background = createBackground(WORLD_W, WORLD_H, WALL, OBSTACLES);
  const versus = settings.mode === 'versus';
  const multi = settings.mode !== 'single';

  // ---------- Pools (pré-alocados uma única vez) ----------
  const enemies = new ObjectPool<Enemy>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 8, kind: 'soldier', health: 0, maxHealth: 1, speed: 0,
    cooldown: 0, fireRate: 1, range: 0, preferredDist: 0, angle: 0, leader: -1, offsetX: 0, offsetY: 0,
    strafeDir: 1, scoreValue: 0, hitFlash: 0
  }), POOL_SIZES.enemies);
  const bullets = new ObjectPool<Projectile>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 3, team: 'player', owner: 0, damage: 0, life: 0, ammo: 'standard', splash: 0
  }), POOL_SIZES.bullets);
  const shells = new ObjectPool<ArtilleryShell>(() => ({
    active: false, fromX: 0, fromY: 0, targetX: 0, targetY: 0, timer: 0, flightTime: 1, damage: 0, splash: 0
  }), POOL_SIZES.shells);
  const particles = new ObjectPool<Particle>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff'
  }), POOL_SIZES.particles);
  const explosions = new ObjectPool<Explosion>(() => ({
    active: false, x: 0, y: 0, maxRadius: 20, life: 0, maxLife: 0.4
  }), POOL_SIZES.explosions);
  const powerups = new ObjectPool<PowerUp>(() => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 10, kind: 'shield', life: 0, bob: 0
  }), POOL_SIZES.powerups);
  const texts = new ObjectPool<FloatText>(() => ({
    active: false, x: 0, y: 0, life: 0, text: '', color: '#fff'
  }), POOL_SIZES.texts);

  // ---------- Estado privado ----------
  const makePlayer = (slot: PlayerSlot, name: string, x: number, y: number, angle: number): Player => ({
    active: true, slot, name: sanitizeName(name, `P${slot}`), color: PLAYER_COLORS[slot], x, y, vx: 0, vy: 0,
    radius: PLAYER.radius, bodyAngle: angle, turretAngle: angle, health: PLAYER.maxHealth, maxHealth: PLAYER.maxHealth,
    lives: versus ? PLAYER.livesVersus : PLAYER.livesSolo, ammo: 'standard', cooldown: 0, shieldTime: 0,
    doubleShotTime: 0, invulnTime: PLAYER.invulnTime, respawnTimer: 0, alive: true, kills: 0, score: 0, hitFlash: 0,
    spawnX: x, spawnY: y
  });

  const players: Player[] = [];
  if (settings.mode === 'single') {
    players.push(makePlayer(1, settings.p1Name, WORLD_W / 2, 470, -Math.PI / 2));
  } else if (settings.mode === 'coop') {
    players.push(makePlayer(1, settings.p1Name, WORLD_W / 2 - 60, 470, -Math.PI / 2));
    players.push(makePlayer(2, settings.p2Name, WORLD_W / 2 + 60, 470, -Math.PI / 2));
  } else {
    players.push(makePlayer(1, settings.p1Name, 90, WORLD_H / 2, 0));
    players.push(makePlayer(2, settings.p2Name, WORLD_W - 90, WORLD_H / 2, Math.PI));
  }

  let totalScore = 0;
  let enemiesDefeated = 0;
  let elapsed = 0;
  let wave = 0;
  let waveBreak = 1.5;
  let spawnTimer = 0;
  let spawnGroups: SpawnGroup[] = [];
  let powerupTimer = versus ? 4 : 12;
  let hudTimer = 0;
  let banner = versus ? 'VERSUS!' : '';
  let bannerTimer = versus ? 2 : 0;
  let shake = 0;
  let paused = false;
  let finished = false;
  let endTimer = 0;
  let winner: string | null = null;

  // ---------- Fábrica de efeitos (sempre via pool) ----------
  const emitParticles = (x: number, y: number, count: number, color: string, speed: number, life: number, size: number): void => {
    for (let i = 0; i < count; i++) {
      const p = particles.acquire();
      if (p === null) return;
      const a = Math.random() * TAU;
      const s = speed * (0.3 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = life * (0.5 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = size;
      p.color = color;
    }
  };

  const spawnExplosion = (x: number, y: number, radius: number): void => {
    const e = explosions.acquire();
    if (e !== null) {
      e.x = x;
      e.y = y;
      e.maxRadius = radius;
      e.life = 0.45;
      e.maxLife = 0.45;
    }
    emitParticles(x, y, Math.floor(radius / 2), '#ff9a3c', radius * 4, 0.6, 3);
    emitParticles(x, y, Math.floor(radius / 3), '#5a5a5a', radius * 2, 0.9, 4);
    shake = Math.min(10, shake + radius / 8);
  };

  const floatText = (x: number, y: number, text: string, color: string): void => {
    const t = texts.acquire();
    if (t === null) return;
    t.x = x;
    t.y = y;
    t.life = 1;
    t.text = text;
    t.color = color;
  };

  const spawnBullet = (
    x: number, y: number, angle: number, speed: number, team: Team, owner: 0 | PlayerSlot,
    damage: number, radius: number, life: number, ammo: AmmoType | 'enemy', splash: number
  ): void => {
    const b = bullets.acquire();
    if (b === null) return;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.team = team;
    b.owner = owner;
    b.damage = damage;
    b.radius = radius;
    b.life = life;
    b.ammo = ammo;
    b.splash = splash;
  };

  // ---------- Dano e morte ----------
  const playerBySlot = (slot: 0 | PlayerSlot): Player | undefined => (slot === 0 ? undefined : players.find((p) => p.slot === slot));

  const killPlayer = (p: Player, attacker: 0 | PlayerSlot): void => {
    p.alive = false;
    p.lives = Math.max(0, p.lives - 1);
    p.respawnTimer = PLAYER.respawnTime;
    p.vx = 0;
    p.vy = 0;
    spawnExplosion(p.x, p.y, 44);
    sound.play('explosion');
    const killer = playerBySlot(attacker);
    if (versus && killer !== undefined && killer !== p) {
      killer.kills++;
      killer.score += 1000;
      totalScore += 1000;
      floatText(killer.x, killer.y - 30, '+1000', killer.color);
    }
  };

  const damagePlayer = (p: Player, amount: number, attacker: 0 | PlayerSlot): void => {
    if (!p.alive || p.invulnTime > 0) return;
    const dmg = safeNumber(amount, 0, 0, 500);
    if (p.shieldTime > 0) {
      emitParticles(p.x, p.y, 6, POWERUPS.shield.color, 120, 0.3, 2);
      return;
    }
    p.health = clamp(p.health - dmg, 0, p.maxHealth);
    p.hitFlash = 0.08;
    shake = Math.min(10, shake + 3);
    sound.play('hit');
    if (p.health <= 0) killPlayer(p, attacker);
  };

  const dropPowerUp = (x: number, y: number, kind?: PowerUpKind): void => {
    const pu = powerups.acquire();
    if (pu === null) return;
    pu.x = clamp(x, BOUNDS.minX + 20, BOUNDS.maxX - 20);
    pu.y = clamp(y, BOUNDS.minY + 20, BOUNDS.maxY - 20);
    pu.kind = kind ?? POWERUP_ORDER[Math.floor(Math.random() * POWERUP_ORDER.length)] ?? 'repair';
    pu.life = 12;
    pu.bob = Math.random() * TAU;
  };

  const killEnemy = (index: number, e: Enemy, owner: 0 | PlayerSlot): void => {
    const cfg = ENEMIES[e.kind];
    spawnExplosion(e.x, e.y, e.kind === 'soldier' ? 18 : 40);
    sound.play('explosion');
    enemiesDefeated++;
    totalScore += e.scoreValue;
    const killer = playerBySlot(owner);
    if (killer !== undefined) {
      killer.kills++;
      killer.score += e.scoreValue;
    }
    floatText(e.x, e.y - 12, SCORE_TEXT[e.kind], '#ffd75e');
    if (Math.random() < cfg.dropChance) dropPowerUp(e.x, e.y);
    enemies.release(e);
    // seguidores perdem o líder e passam a agir sozinhos
    const list = enemies.items;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f !== undefined && f.active && f.leader === index) f.leader = -1;
    }
  };

  const damageEnemy = (index: number, e: Enemy, amount: number, owner: 0 | PlayerSlot): void => {
    if (!e.active) return;
    e.health -= safeNumber(amount, 0, 0, 1000);
    e.hitFlash = 0.06;
    if (e.health <= 0) killEnemy(index, e, owner);
  };

  const splashDamage = (x: number, y: number, radius: number, damage: number, team: Team, owner: 0 | PlayerSlot): void => {
    spawnExplosion(x, y, radius * 0.8);
    sound.play('explosion');
    const r2 = radius * radius;
    if (team === 'player') {
      const list = enemies.items;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === undefined || !e.active) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) damageEnemy(i, e, damage * (1 - Math.sqrt(d2) / radius) + damage * 0.25, owner);
      }
    }
    for (const p of players) {
      if (team === 'player' && (!versus || p.slot === owner)) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) damagePlayer(p, damage * (1 - Math.sqrt(d2) / radius) + damage * 0.2, owner);
    }
  };

  // ---------- Ondas ----------
  const startWave = (n: number): void => {
    wave = n;
    const mult = settings.mode === 'coop' ? 1.5 : 1;
    const groups: SpawnGroup[] = [];
    let soldiers = Math.floor((3 + n * 2) * mult);
    while (soldiers > 0) {
      const size = Math.min(soldiers, 3 + Math.floor(Math.random() * 3));
      groups.push({ kind: 'soldier', count: size });
      soldiers -= size;
    }
    const tanks = Math.floor((n >= 2 ? Math.floor(n / 2) + 1 : 0) * mult);
    for (let i = 0; i < tanks; i++) groups.splice(Math.floor(Math.random() * (groups.length + 1)), 0, { kind: 'lightTank', count: 1 });
    const arty = n >= 3 ? Math.floor(((n - 1) / 2) * mult) : 0;
    for (let i = 0; i < arty; i++) groups.push({ kind: 'artillery', count: 1 });
    spawnGroups = groups;
    spawnTimer = 0.5;
    banner = `ONDA ${n}`;
    bannerTimer = 2.2;
    sound.play('wave');
  };

  const edgePoint = (out: { x: number; y: number }): void => {
    for (let tries = 0; tries < 10; tries++) {
      const side = Math.floor(Math.random() * 3); // topo, esquerda, direita (base é a área dos jogadores)
      if (side === 0) {
        out.x = 60 + Math.random() * (WORLD_W - 120);
        out.y = WALL + 24;
      } else {
        out.x = side === 1 ? WALL + 24 : WORLD_W - WALL - 24;
        out.y = 40 + Math.random() * (WORLD_H * 0.6);
      }
      if (!pointInObstacle(out.x, out.y, 30)) return;
    }
  };

  const spawnPoint = { x: 0, y: 0 };

  const spawnEnemy = (kind: EnemyKind, x: number, y: number, leader: number, ox: number, oy: number): number => {
    const e = enemies.acquire();
    if (e === null) return -1;
    const cfg = ENEMIES[kind];
    const scale = 1 + 0.08 * (wave - 1);
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.radius = cfg.radius;
    e.maxHealth = Math.floor(cfg.health * scale);
    e.health = e.maxHealth;
    e.speed = cfg.speed * (1 + 0.03 * (wave - 1));
    e.fireRate = Math.max(cfg.fireRate * 0.55, cfg.fireRate * (1 - 0.04 * (wave - 1)));
    e.cooldown = 1 + Math.random() * cfg.fireRate;
    e.range = cfg.range;
    e.preferredDist = cfg.preferredDist;
    e.angle = Math.atan2(WORLD_H / 2 - y, WORLD_W / 2 - x);
    e.leader = leader;
    e.offsetX = ox;
    e.offsetY = oy;
    e.strafeDir = Math.random() < 0.5 ? 1 : -1;
    e.scoreValue = cfg.score;
    e.hitFlash = 0;
    emitParticles(x, y, 8, '#d9d9c0', 80, 0.4, 2);
    return enemies.items.indexOf(e);
  };

  const spawnGroup = (g: SpawnGroup): void => {
    edgePoint(spawnPoint);
    const leaderIndex = spawnEnemy(g.kind, spawnPoint.x, spawnPoint.y, -1, 0, 0);
    // formação em "V" atrás do líder
    for (let k = 1; k < g.count; k++) {
      const row = Math.ceil(k / 2);
      const side = k % 2 === 0 ? 1 : -1;
      const ox = -row * 24;
      const oy = side * row * 20;
      spawnEnemy(g.kind, spawnPoint.x + (Math.random() - 0.5) * 20, spawnPoint.y + (Math.random() - 0.5) * 20, leaderIndex, ox, oy);
    }
  };

  // ---------- Atualização dos jogadores ----------
  const schemeFor = (p: Player): ControlScheme => (settings.mode === 'single' ? SOLO_CONTROLS : CONTROLS[p.slot]);

  const fire = (p: Player): void => {
    const cfg = AMMO[p.ammo];
    const a = p.turretAngle + (Math.random() - 0.5) * cfg.spread;
    const cos = Math.cos(p.turretAngle);
    const sin = Math.sin(p.turretAngle);
    const tipX = p.x + cos * 24;
    const tipY = p.y + sin * 24;
    if (p.doubleShotTime > 0) {
      spawnBullet(tipX - sin * 6, tipY + cos * 6, a, cfg.speed, 'player', p.slot, cfg.damage, cfg.radius, cfg.life, p.ammo, cfg.splash);
      spawnBullet(tipX + sin * 6, tipY - cos * 6, a, cfg.speed, 'player', p.slot, cfg.damage, cfg.radius, cfg.life, p.ammo, cfg.splash);
    } else {
      spawnBullet(tipX, tipY, a, cfg.speed, 'player', p.slot, cfg.damage, cfg.radius, cfg.life, p.ammo, cfg.splash);
    }
    p.cooldown = cfg.cooldown;
    emitParticles(tipX, tipY, 3, cfg.color, 90, 0.15, 2);
    sound.play(p.ammo === 'heavy' ? 'heavy' : p.ammo === 'rapid' ? 'rapid' : 'shoot');
  };

  const respawn = (p: Player): void => {
    p.alive = true;
    p.health = p.maxHealth;
    p.x = p.spawnX;
    p.y = p.spawnY;
    p.vx = 0;
    p.vy = 0;
    p.invulnTime = PLAYER.invulnTime;
    p.shieldTime = 0;
    p.doubleShotTime = 0;
    emitParticles(p.x, p.y, 16, p.color, 120, 0.5, 3);
  };

  const updatePlayer = (p: Player, dt: number): void => {
    if (!p.alive) {
      if (p.lives > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawn(p);
      }
      return;
    }
    const keys = schemeFor(p);
    let ix = 0;
    let iy = 0;
    if (input.isDown(keys.left)) ix -= 1;
    if (input.isDown(keys.right)) ix += 1;
    if (input.isDown(keys.up)) iy -= 1;
    if (input.isDown(keys.down)) iy += 1;
    const moving = ix !== 0 || iy !== 0;
    if (ix !== 0 && iy !== 0) {
      ix *= Math.SQRT1_2;
      iy *= Math.SQRT1_2;
    }
    const k = Math.min(1, dt * 10);
    p.vx += (ix * PLAYER.speed - p.vx) * k;
    p.vy += (iy * PLAYER.speed - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    for (const o of OBSTACLES) pushOutOfRect(p, o);
    enforceEntityBounds(p, BOUNDS, p.spawnX, p.spawnY);

    if (moving) p.bodyAngle = lerpAngle(p.bodyAngle, Math.atan2(iy, ix), dt * PLAYER.turnRate);

    const mouseAim = p.slot === 1 && settings.aimMode === 'mouse';
    if (mouseAim) {
      p.turretAngle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
    } else if (moving) {
      p.turretAngle = lerpAngle(p.turretAngle, Math.atan2(iy, ix), dt * PLAYER.turnRate * 1.4);
    }

    if (input.wasPressed(keys.switchAmmo)) {
      const idx = AMMO_ORDER.indexOf(p.ammo);
      p.ammo = AMMO_ORDER[(idx + 1) % AMMO_ORDER.length] ?? 'standard';
      floatText(p.x, p.y - 28, AMMO[p.ammo].label, AMMO[p.ammo].color);
      sound.play('select');
    }

    p.cooldown -= dt;
    const firing = input.isDown(keys.fire) || (mouseAim && input.mouse.down);
    if (firing && p.cooldown <= 0) fire(p);

    if (p.shieldTime > 0) p.shieldTime = Math.max(0, p.shieldTime - dt);
    if (p.doubleShotTime > 0) p.doubleShotTime = Math.max(0, p.doubleShotTime - dt);
    if (p.invulnTime > 0) p.invulnTime = Math.max(0, p.invulnTime - dt);
    if (p.hitFlash > 0) p.hitFlash -= dt;

    // coleta de power-ups
    const list = powerups.items;
    for (let i = 0; i < list.length; i++) {
      const pu = list[i];
      if (pu === undefined || !pu.active) continue;
      const dx = pu.x - p.x;
      const dy = pu.y - p.y;
      const r = pu.radius + p.radius;
      if (dx * dx + dy * dy < r * r) {
        if (pu.kind === 'shield') p.shieldTime = POWERUPS.shield.duration;
        else if (pu.kind === 'doubleShot') p.doubleShotTime = POWERUPS.doubleShot.duration;
        else p.health = Math.min(p.maxHealth, p.health + 40);
        floatText(p.x, p.y - 30, POWERUPS[pu.kind].label, POWERUPS[pu.kind].color);
        emitParticles(pu.x, pu.y, 14, POWERUPS[pu.kind].color, 140, 0.5, 2);
        sound.play('powerup');
        powerups.release(pu);
      }
    }
  };

  // ---------- IA inimiga ----------
  const nearestPlayer = (x: number, y: number): Player | null => {
    let best: Player | null = null;
    let bestD = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  const enemyFire = (e: Enemy, target: Player): void => {
    const cfg = ENEMIES[e.kind];
    if (e.kind === 'artillery') {
      const s = shells.acquire();
      if (s === null) return;
      s.fromX = e.x;
      s.fromY = e.y;
      // mira com antecipação do movimento do alvo
      s.targetX = clamp(target.x + target.vx * 0.8 + (Math.random() - 0.5) * 30, BOUNDS.minX, BOUNDS.maxX);
      s.targetY = clamp(target.y + target.vy * 0.8 + (Math.random() - 0.5) * 30, BOUNDS.minY, BOUNDS.maxY);
      s.timer = 0;
      s.flightTime = 1.5;
      s.damage = cfg.bulletDamage;
      s.splash = 60;
      emitParticles(e.x + Math.cos(e.angle) * 30, e.y + Math.sin(e.angle) * 30, 8, '#bbbbaa', 80, 0.5, 3);
      sound.play('heavy');
      return;
    }
    const a = Math.atan2(target.y - e.y, target.x - e.x) + (Math.random() - 0.5) * (e.kind === 'soldier' ? 0.25 : 0.1);
    const tip = e.radius + 6;
    spawnBullet(e.x + Math.cos(a) * tip, e.y + Math.sin(a) * tip, a, cfg.bulletSpeed, 'enemy', 0, cfg.bulletDamage,
      e.kind === 'soldier' ? 2 : 4, 2.2, 'enemy', 0);
    sound.play('enemyShoot');
  };

  const updateEnemies = (dt: number): void => {
    const list = enemies.items;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === undefined || !e.active) continue;
      const target = nearestPlayer(e.x, e.y);
      let mx = 0;
      let my = 0;
      let dist = Infinity;
      if (target !== null) {
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const leader = e.leader >= 0 ? list[e.leader] : undefined;
        if (leader !== undefined && leader.active && leader.kind === e.kind && dist > e.preferredDist) {
          // mantém posição na formação tática
          const cos = Math.cos(leader.angle);
          const sin = Math.sin(leader.angle);
          const gx = leader.x + cos * e.offsetX - sin * e.offsetY - e.x;
          const gy = leader.y + sin * e.offsetX + cos * e.offsetY - e.y;
          const gd = Math.sqrt(gx * gx + gy * gy);
          if (gd > 4) {
            const boost = gd > 40 ? 1.3 : 1;
            mx = (gx / gd) * boost;
            my = (gy / gd) * boost;
          }
        } else if (dist > e.preferredDist + 40) {
          mx = nx;
          my = ny;
        } else if (dist < e.preferredDist - 40) {
          mx = -nx;
          my = -ny;
        } else {
          // movimento lateral (strafe) mantendo distância
          mx = -ny * e.strafeDir * 0.7;
          my = nx * e.strafeDir * 0.7;
          if (Math.random() < dt * 0.3) e.strafeDir = e.strafeDir === 1 ? -1 : 1;
        }
        const aimA = Math.atan2(dy, dx);
        e.angle = lerpAngle(e.angle, mx !== 0 || my !== 0 ? Math.atan2(my, mx) : aimA, dt * 4);
        e.cooldown -= dt;
        if (dist < e.range && e.cooldown <= 0) {
          e.cooldown = e.fireRate * (0.8 + Math.random() * 0.4);
          enemyFire(e, target);
        }
      }
      e.vx = mx * e.speed;
      e.vy = my * e.speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      for (const o of OBSTACLES) {
        if (pushOutOfRect(e, o)) e.strafeDir = e.strafeDir === 1 ? -1 : 1;
      }
      // separação entre inimigos
      for (let j = i + 1; j < list.length; j++) {
        const f = list[j];
        if (f === undefined || !f.active) continue;
        const dx = f.x - e.x;
        const dy = f.y - e.y;
        const r = e.radius + f.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (r - d) / 2;
          const px = (dx / d) * push;
          const py = (dy / d) * push;
          e.x -= px;
          e.y -= py;
          f.x += px;
          f.y += py;
        }
      }
      // colisão de contato com jogadores
      for (const p of players) {
        if (!p.alive) continue;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const r = p.radius + e.radius;
        if (dx * dx + dy * dy < r * r) {
          damagePlayer(p, (e.kind === 'soldier' ? 10 : 20) * dt * 3, 0);
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          e.x -= (dx / d) * 2;
          e.y -= (dy / d) * 2;
        }
      }
      if (e.hitFlash > 0) e.hitFlash -= dt;
      enforceEntityBounds(e, BOUNDS, WORLD_W / 2, WALL + 40);
    }
  };

  // ---------- Projéteis (colisão por círculos) ----------
  const updateBullets = (dt: number): void => {
    const list = bullets.items;
    const elist = enemies.items;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b === undefined || !b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let hit = b.life <= 0 || b.x < BOUNDS.minX || b.x > BOUNDS.maxX || b.y < BOUNDS.minY || b.y > BOUNDS.maxY || !Number.isFinite(b.x);
      if (!hit && pointInObstacle(b.x, b.y, b.radius)) hit = true;

      if (!hit && b.team === 'player') {
        for (let j = 0; j < elist.length; j++) {
          const e = elist[j];
          if (e === undefined || !e.active) continue;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const r = e.radius + b.radius;
          if (dx * dx + dy * dy < r * r) {
            if (b.splash <= 0) damageEnemy(j, e, b.damage, b.owner);
            hit = true;
            break;
          }
        }
      }
      if (!hit && (b.team === 'enemy' || versus)) {
        for (const p of players) {
          if (!p.alive || (b.team === 'player' && p.slot === b.owner)) continue;
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const r = p.radius + b.radius;
          if (dx * dx + dy * dy < r * r) {
            if (b.splash <= 0) damagePlayer(p, b.damage, b.owner);
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        if (b.splash > 0) splashDamage(b.x, b.y, b.splash, b.damage, b.team, b.owner);
        else emitParticles(b.x, b.y, 4, b.team === 'enemy' ? '#ff6b6b' : '#ffe9a0', 80, 0.2, 2);
        bullets.release(b);
      }
    }

    const slist = shells.items;
    for (let i = 0; i < slist.length; i++) {
      const s = slist[i];
      if (s === undefined || !s.active) continue;
      s.timer += dt;
      if (s.timer >= s.flightTime) {
        splashDamage(s.targetX, s.targetY, s.splash, s.damage, 'enemy', 0);
        shells.release(s);
      }
    }
  };

  const updateEffects = (dt: number): void => {
    const plist = particles.items;
    for (let i = 0; i < plist.length; i++) {
      const p = plist[i];
      if (p === undefined || !p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        particles.release(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    const xlist = explosions.items;
    for (let i = 0; i < xlist.length; i++) {
      const x = xlist[i];
      if (x === undefined || !x.active) continue;
      x.life -= dt;
      if (x.life <= 0) explosions.release(x);
    }
    const tlist = texts.items;
    for (let i = 0; i < tlist.length; i++) {
      const t = tlist[i];
      if (t === undefined || !t.active) continue;
      t.life -= dt;
      t.y -= 24 * dt;
      if (t.life <= 0) texts.release(t);
    }
    const ulist = powerups.items;
    for (let i = 0; i < ulist.length; i++) {
      const u = ulist[i];
      if (u === undefined || !u.active) continue;
      u.life -= dt;
      u.bob += dt * 4;
      if (u.life <= 0) powerups.release(u);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 20);
  };

  // ---------- Regras de partida ----------
  const updateRules = (dt: number): void => {
    if (bannerTimer > 0) bannerTimer -= dt;

    powerupTimer -= dt;
    if (powerupTimer <= 0) {
      powerupTimer = versus ? 7 : 15;
      if (powerups.inUse < 3) {
        let x = 0;
        let y = 0;
        for (let t = 0; t < 10; t++) {
          x = 80 + Math.random() * (WORLD_W - 160);
          y = 80 + Math.random() * (WORLD_H - 160);
          if (!pointInObstacle(x, y, 20)) break;
        }
        dropPowerUp(x, y);
      }
    }

    if (versus) {
      const loser = players.find((p) => !p.alive && p.lives <= 0);
      if (loser !== undefined) {
        const champ = players.find((p) => p !== loser);
        winner = champ?.name ?? null;
        finish();
      }
      return;
    }

    // ondas de inimigos
    if (spawnGroups.length > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const g = spawnGroups.shift();
        if (g !== undefined) spawnGroup(g);
        spawnTimer = 1.4 + Math.random() * 0.8;
      }
    } else if (enemies.inUse === 0) {
      if (wave > 0 && waveBreak <= 0) {
        const bonus = 500 * wave;
        totalScore += bonus;
        floatText(WORLD_W / 2, WORLD_H / 2, `BÔNUS +${bonus}`, '#ffd75e');
        waveBreak = 3;
      }
      waveBreak -= dt;
      if (waveBreak <= 0) startWave(wave + 1);
    }

    if (players.every((p) => !p.alive && p.lives <= 0)) finish();
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    endTimer = 1.6;
    banner = versus ? 'FIM DE COMBATE' : 'DERROTA';
    bannerTimer = 2;
  };

  const emitStats = (): void => {
    sound.play('gameover');
    callbacks.onGameOver({
      mode: settings.mode,
      score: totalScore,
      elapsedSeconds: Math.floor(elapsed),
      enemiesDefeated,
      wave,
      winner,
      players: players.map((p) => ({ name: p.name, score: p.score, kills: p.kills }))
    });
  };

  const emitHud = (): void => {
    let enemiesLeft = enemies.inUse;
    for (const g of spawnGroups) enemiesLeft += g.count;
    callbacks.onHud({
      players: players.map((p) => ({
        slot: p.slot, name: p.name, color: p.color, health: Math.ceil(p.health), maxHealth: p.maxHealth, lives: p.lives,
        ammo: p.ammo, shield: p.shieldTime, doubleShot: p.doubleShotTime, alive: p.alive, score: p.score, kills: p.kills
      })),
      wave,
      score: totalScore,
      enemiesLeft,
      elapsed: Math.floor(elapsed),
      banner: bannerTimer > 0 ? banner : ''
    });
  };

  const update = (dt: number): void => {
    if (input.wasPressed(PAUSE_KEYS) && !finished) callbacks.onPauseToggle();
    if (paused) {
      input.endFrame();
      return;
    }
    elapsed += finished ? 0 : dt;
    if (!finished) {
      for (const p of players) updatePlayer(p, dt);
      updateEnemies(dt);
      updateRules(dt);
    } else {
      endTimer -= dt;
      if (endTimer <= 0 && loop.running) {
        loop.stop();
        emitStats();
      }
    }
    updateBullets(dt);
    updateEffects(dt);
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = HUD_INTERVAL;
      emitHud();
    }
    input.endFrame();
  };

  // ---------- Renderização (coordenadas sempre inteiras) ----------
  const render = (): void => {
    const sx = shake > 0 ? Math.floor((Math.random() - 0.5) * shake) : 0;
    const sy = shake > 0 ? Math.floor((Math.random() - 0.5) * shake) : 0;
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.drawImage(background, 0, 0);

    // alvos de artilharia (aviso)
    const slist = shells.items;
    for (let i = 0; i < slist.length; i++) {
      const s = slist[i];
      if (s === undefined || !s.active) continue;
      const t = s.timer / s.flightTime;
      ctx.strokeStyle = Math.floor(s.timer * 10) % 2 === 0 ? '#ff3b3b' : '#ffb03b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.floor(s.targetX), Math.floor(s.targetY), Math.floor(s.splash * (1 - t * 0.5)), 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,59,59,0.15)';
      ctx.fill();
    }

    // power-ups
    const ulist = powerups.items;
    for (let i = 0; i < ulist.length; i++) {
      const u = ulist[i];
      if (u === undefined || !u.active) continue;
      if (u.life < 3 && Math.floor(u.life * 8) % 2 === 0) continue;
      const x = Math.floor(u.x);
      const y = Math.floor(u.y + Math.sin(u.bob) * 3);
      const color = POWERUPS[u.kind].color;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 11, y - 11, 22, 22);
      ctx.fillStyle = color;
      ctx.fillRect(x - 9, y - 9, 18, 18);
      ctx.fillStyle = '#111111';
      if (u.kind === 'shield') {
        ctx.fillRect(x - 5, y - 6, 10, 8);
        ctx.fillRect(x - 3, y + 2, 6, 3);
      } else if (u.kind === 'doubleShot') {
        ctx.fillRect(x - 6, y - 6, 3, 12);
        ctx.fillRect(x + 3, y - 6, 3, 12);
      } else {
        ctx.fillRect(x - 2, y - 7, 4, 14);
        ctx.fillRect(x - 7, y - 2, 14, 4);
      }
    }

    // inimigos
    const elist = enemies.items;
    for (let i = 0; i < elist.length; i++) {
      const e = elist[i];
      if (e === undefined || !e.active) continue;
      const flash = e.hitFlash > 0;
      if (e.kind === 'soldier') {
        drawSprite(ctx, sprites.soldier, e.x, e.y, e.angle, flash);
      } else if (e.kind === 'lightTank') {
        drawSprite(ctx, sprites.tankBody, e.x, e.y, e.angle, flash);
        const target = nearestPlayer(e.x, e.y);
        const ta = target !== null ? Math.atan2(target.y - e.y, target.x - e.x) : e.angle;
        drawSprite(ctx, sprites.tankTurret, e.x, e.y, ta, flash);
      } else {
        drawSprite(ctx, sprites.artyBody, e.x, e.y, e.angle, flash);
        const target = nearestPlayer(e.x, e.y);
        const ta = target !== null ? Math.atan2(target.y - e.y, target.x - e.x) : e.angle;
        drawSprite(ctx, sprites.artyTurret, e.x, e.y, ta, flash);
      }
      if (e.health < e.maxHealth) drawBar(ctx, e.x, e.y - e.radius - 8, e.kind === 'soldier' ? 16 : 28, e.health / e.maxHealth, '#ff5a3c');
    }

    // jogadores
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (const p of players) {
      if (!p.alive) continue;
      if (p.invulnTime > 0 && Math.floor(p.invulnTime * 12) % 2 === 0) continue;
      const flash = p.hitFlash > 0;
      drawSprite(ctx, p.slot === 1 ? sprites.p1Body : sprites.p2Body, p.x, p.y, p.bodyAngle, flash);
      drawSprite(ctx, p.slot === 1 ? sprites.p1Turret : sprites.p2Turret, p.x, p.y, p.turretAngle, flash);
      if (p.shieldTime > 0) {
        ctx.strokeStyle = POWERUPS.shield.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.floor(p.x), Math.floor(p.y), 22 + Math.floor(Math.sin(elapsed * 8) * 2), 0, TAU);
        ctx.stroke();
      }
      drawBar(ctx, p.x, p.y - 28, 30, p.health / p.maxHealth, p.health > 35 ? '#7dff6a' : '#ff5a3c');
      ctx.fillStyle = '#000000';
      ctx.fillText(p.name, Math.floor(p.x) + 1, Math.floor(p.y) - 33);
      ctx.fillStyle = p.color;
      ctx.fillText(p.name, Math.floor(p.x), Math.floor(p.y) - 34);
    }

    // projéteis
    const blist = bullets.items;
    for (let i = 0; i < blist.length; i++) {
      const b = blist[i];
      if (b === undefined || !b.active) continue;
      const size = b.radius * 2;
      ctx.fillStyle = b.ammo === 'enemy' ? '#ff4d4d' : AMMO[b.ammo].color;
      ctx.fillRect(Math.floor(b.x - b.radius), Math.floor(b.y - b.radius), size, size);
    }

    // obuses de artilharia em arco
    for (let i = 0; i < slist.length; i++) {
      const s = slist[i];
      if (s === undefined || !s.active) continue;
      const t = s.timer / s.flightTime;
      const x = s.fromX + (s.targetX - s.fromX) * t;
      const y = s.fromY + (s.targetY - s.fromY) * t;
      const h = Math.sin(t * Math.PI) * 90;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(Math.floor(x - 3), Math.floor(y - 2), 6, 4);
      ctx.fillStyle = '#e8e8d8';
      ctx.fillRect(Math.floor(x - 4), Math.floor(y - h - 4), 8, 8);
    }

    // explosões
    const xlist = explosions.items;
    for (let i = 0; i < xlist.length; i++) {
      const x = xlist[i];
      if (x === undefined || !x.active) continue;
      const t = 1 - x.life / x.maxLife;
      const r = Math.floor(x.maxRadius * (0.4 + t * 0.6));
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.arc(Math.floor(x.x), Math.floor(x.y), r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(Math.floor(x.x), Math.floor(x.y), Math.floor(r * 0.55), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // partículas
    const plist = particles.items;
    for (let i = 0; i < plist.length; i++) {
      const p = plist[i];
      if (p === undefined || !p.active) continue;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // textos flutuantes
    const tlist = texts.items;
    for (let i = 0; i < tlist.length; i++) {
      const t = tlist[i];
      if (t === undefined || !t.active) continue;
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.fillStyle = '#000000';
      ctx.fillText(t.text, Math.floor(t.x) + 1, Math.floor(t.y) + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, Math.floor(t.x), Math.floor(t.y));
    }
    ctx.globalAlpha = 1;

    // mira do mouse
    if (settings.aimMode === 'mouse' && players[0]?.alive === true) {
      const mx = Math.floor(input.mouse.x);
      const my = Math.floor(input.mouse.y);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 8, my, 5, 1);
      ctx.fillRect(mx + 4, my, 5, 1);
      ctx.fillRect(mx, my - 8, 1, 5);
      ctx.fillRect(mx, my + 4, 1, 5);
    }

    if (paused) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  };

  const loop = createGameLoop(update, render);
  if (multi) logger.info('game', `Partida multiplayer local iniciada (${settings.mode})`);

  return Object.freeze({
    start: (): void => {
      loop.start();
      emitHud();
    },
    setPaused: (value: boolean): void => {
      paused = value;
      if (value) render();
    },
    destroy: (): void => {
      loop.stop();
      input.destroy();
      sound.destroy();
      enemies.releaseAll();
      bullets.releaseAll();
      shells.releaseAll();
      particles.releaseAll();
      explosions.releaseAll();
      powerups.releaseAll();
      texts.releaseAll();
    }
  });
}
