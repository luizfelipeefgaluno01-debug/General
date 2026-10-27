/**
 * Utilitários de renderização: sprites pré-renderizados em canvases offscreen
 * e funções de desenho que SEMPRE usam coordenadas inteiras (Math.floor).
 */
import type { Obstacle } from '../types/game';

export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly flash: HTMLCanvasElement;
  readonly pivotX: number;
  readonly pivotY: number;
}

type Painter = (ctx: CanvasRenderingContext2D) => void;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('Canvas 2D indisponível');
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function makeSprite(w: number, h: number, pivotX: number, pivotY: number, paint: Painter): Sprite {
  const [canvas, ctx] = makeCanvas(w, h);
  paint(ctx);
  const [flash, fctx] = makeCanvas(w, h);
  fctx.drawImage(canvas, 0, 0);
  fctx.globalCompositeOperation = 'source-in';
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, w, h);
  return { canvas, flash, pivotX, pivotY };
}

function shade(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function tankBody(base: string, light: string, dark: string, len = 32): Sprite {
  return makeSprite(len, 24, len / 2, 12, (c) => {
    shade(c, '#1c1c1c', 0, 0, len, 6);
    shade(c, '#1c1c1c', 0, 18, len, 6);
    for (let x = 1; x < len; x += 4) {
      shade(c, '#3d3d3d', x, 1, 2, 4);
      shade(c, '#3d3d3d', x, 19, 2, 4);
    }
    shade(c, base, 3, 5, len - 6, 14);
    shade(c, light, 3, 5, len - 6, 2);
    shade(c, dark, 3, 17, len - 6, 2);
    shade(c, dark, len - 5, 7, 3, 10);
    shade(c, light, 6, 9, 4, 6);
  });
}

function turret(base: string, light: string, dark: string, barrel = 22): Sprite {
  const w = 14 + barrel;
  return makeSprite(w, 14, 10, 7, (c) => {
    shade(c, '#2a2a2a', 14, 5, barrel, 4);
    shade(c, '#4a4a4a', 14, 5, barrel, 1);
    shade(c, '#2a2a2a', w - 4, 4, 4, 6);
    shade(c, dark, 2, 1, 16, 12);
    shade(c, base, 3, 2, 14, 10);
    shade(c, light, 3, 2, 14, 2);
    shade(c, dark, 7, 5, 5, 4);
  });
}

function soldier(helmet: string, uniform: string): Sprite {
  return makeSprite(18, 16, 8, 8, (c) => {
    shade(c, '#1a1a1a', 10, 6, 8, 2); // fuzil
    shade(c, uniform, 3, 2, 8, 12); // ombros
    shade(c, '#2b2015', 3, 2, 8, 1);
    shade(c, helmet, 4, 4, 7, 8); // capacete
    shade(c, '#ffffff22', 5, 5, 3, 2);
  });
}

export interface SpriteSet {
  readonly p1Body: Sprite;
  readonly p1Turret: Sprite;
  readonly p2Body: Sprite;
  readonly p2Turret: Sprite;
  readonly tankBody: Sprite;
  readonly tankTurret: Sprite;
  readonly artyBody: Sprite;
  readonly artyTurret: Sprite;
  readonly soldier: Sprite;
}

export function createSprites(): SpriteSet {
  return Object.freeze({
    p1Body: tankBody('#6b7d3a', '#8fa352', '#3d4d20'),
    p1Turret: turret('#6b7d3a', '#a4b86a', '#3d4d20'),
    p2Body: tankBody('#3f6d8c', '#6b9cbf', '#244459'),
    p2Turret: turret('#3f6d8c', '#8dbbd9', '#244459'),
    tankBody: tankBody('#8c3b2e', '#b5573f', '#521f17', 30),
    tankTurret: turret('#8c3b2e', '#c46a52', '#521f17', 18),
    artyBody: tankBody('#5d5d55', '#84847a', '#36362f', 36),
    artyTurret: turret('#5d5d55', '#9a9a8e', '#36362f', 34),
    soldier: soldier('#7a2f25', '#5a4a2a')
  });
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  angle: number,
  flash: boolean
): void {
  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));
  ctx.rotate(angle);
  ctx.drawImage(flash ? sprite.flash : sprite.canvas, -sprite.pivotX, -sprite.pivotY);
  ctx.restore();
}

export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string): void {
  const fx = Math.floor(x - w / 2);
  const fy = Math.floor(y);
  const r = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
  ctx.fillStyle = '#000000';
  ctx.fillRect(fx - 1, fy - 1, w + 2, 5);
  ctx.fillStyle = '#3a0d0d';
  ctx.fillRect(fx, fy, w, 3);
  ctx.fillStyle = color;
  ctx.fillRect(fx, fy, Math.floor(w * r), 3);
}

/** Gerador pseudoaleatório determinístico para o cenário. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  const x = Math.floor(o.x);
  const y = Math.floor(o.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 4, y + 4, o.w, o.h);
  if (o.kind === 'sandbag') {
    for (let bx = 0; bx < o.w; bx += 16) {
      for (let row = 0; row < o.h; row += 11) {
        const off = (row / 11) % 2 === 0 ? 0 : 8;
        const cx = x + bx + off;
        const w = Math.min(15, x + o.w - cx);
        if (w <= 2) continue;
        ctx.fillStyle = '#8a7a4e';
        ctx.fillRect(cx, y + row, w, 10);
        ctx.fillStyle = '#a8975f';
        ctx.fillRect(cx + 1, y + row + 1, w - 2, 3);
        ctx.fillStyle = '#5e5233';
        ctx.fillRect(cx, y + row + 9, w, 1);
      }
    }
  } else if (o.kind === 'bunker') {
    ctx.fillStyle = '#4a4a44';
    ctx.fillRect(x, y, o.w, o.h);
    ctx.fillStyle = '#62625a';
    ctx.fillRect(x + 4, y + 4, o.w - 8, o.h - 8);
    ctx.fillStyle = '#2c2c28';
    ctx.fillRect(x + 12, y + o.h / 2 - 3, o.w - 24, 6);
    ctx.fillStyle = '#7a7a70';
    ctx.fillRect(x + 4, y + 4, o.w - 8, 3);
    ctx.fillStyle = '#e3b341';
    ctx.fillRect(x + o.w / 2 - 4, y + 12, 8, 8);
  } else {
    ctx.fillStyle = '#5b3d1f';
    ctx.fillRect(x, y, o.w, o.h);
    ctx.fillStyle = '#7c5530';
    ctx.fillRect(x + 2, y + 2, o.w - 4, o.h - 4);
    ctx.fillStyle = '#5b3d1f';
    ctx.fillRect(x + 2, y + o.h / 2 - 1, o.w - 4, 3);
    ctx.fillRect(x + o.w / 2 - 1, y + 2, 3, o.h - 4);
  }
}

/** Pré-renderiza o campo de batalha inteiro (chão, crateras, muros e obstáculos estáticos). */
export function createBackground(width: number, height: number, wall: number, obstacles: readonly Obstacle[]): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(width, height);
  const rand = seeded(1942);
  const grass = ['#3a4a24', '#36451f', '#3f5028', '#344220'];
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      ctx.fillStyle = grass[Math.floor(rand() * grass.length)] ?? '#3a4a24';
      ctx.fillRect(x, y, 8, 8);
    }
  }
  // trilhas de terra
  ctx.fillStyle = '#5b4a32';
  for (let i = 0; i < 260; i++) {
    const t = i / 260;
    const px = Math.floor(t * width);
    const py = Math.floor(height / 2 + Math.sin(t * 9) * 90);
    ctx.fillRect(px, py - 10, 8, 20);
  }
  ctx.fillStyle = '#4c3d29';
  for (let i = 0; i < 260; i++) {
    const t = i / 260;
    ctx.fillRect(Math.floor(t * width), Math.floor(height / 2 + Math.sin(t * 9) * 90) - 4, 8, 2);
    ctx.fillRect(Math.floor(t * width), Math.floor(height / 2 + Math.sin(t * 9) * 90) + 3, 8, 2);
  }
  // crateras
  for (let i = 0; i < 14; i++) {
    const cx = Math.floor(60 + rand() * (width - 120));
    const cy = Math.floor(60 + rand() * (height - 120));
    const r = Math.floor(8 + rand() * 14);
    ctx.fillStyle = '#2a2416';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c180f';
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, Math.floor(r * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  // tufos de grama
  ctx.fillStyle = '#56692f';
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), 2, 2);
  }
  // muro perimetral
  ctx.fillStyle = '#1b2414';
  ctx.fillRect(0, 0, width, wall);
  ctx.fillRect(0, height - wall, width, wall);
  ctx.fillRect(0, 0, wall, height);
  ctx.fillRect(width - wall, 0, wall, height);
  ctx.fillStyle = '#2d3a20';
  for (let x = 0; x < width; x += 24) {
    ctx.fillRect(x + 2, 3, 20, 10);
    ctx.fillRect(x + 2, height - 13, 20, 10);
  }
  for (let y = 24; y < height - 24; y += 24) {
    ctx.fillRect(3, y + 2, 10, 20);
    ctx.fillRect(width - 13, y + 2, 10, 20);
  }
  for (const o of obstacles) drawObstacle(ctx, o);
  return canvas;
}
