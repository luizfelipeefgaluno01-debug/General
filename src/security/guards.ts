/**
 * Programação defensiva para o motor: validação de números e limites físicos.
 */
import type { Entity } from '../types/game';
import { logger } from './logger';

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Garante que a entidade tenha posição/velocidade válidas e esteja dentro da arena.
 * Retorna `false` se foi necessário corrigir um valor inválido (NaN/Infinity).
 */
export function enforceEntityBounds(entity: Entity, bounds: Bounds, fallbackX: number, fallbackY: number): boolean {
  let valid = true;
  if (!isFiniteNumber(entity.x) || !isFiniteNumber(entity.y)) {
    entity.x = fallbackX;
    entity.y = fallbackY;
    valid = false;
  }
  if (!isFiniteNumber(entity.vx) || !isFiniteNumber(entity.vy)) {
    entity.vx = 0;
    entity.vy = 0;
    valid = false;
  }
  const r = entity.radius;
  entity.x = clamp(entity.x, bounds.minX + r, bounds.maxX - r);
  entity.y = clamp(entity.y, bounds.minY + r, bounds.maxY - r);
  if (!valid) logger.warn('guards', 'Entidade com coordenadas inválidas foi corrigida');
  return valid;
}

/** Valida um valor numérico vindo de fora do motor (ex.: dano, delta). */
export function safeNumber(value: number, fallback: number, min: number, max: number): number {
  return isFiniteNumber(value) ? clamp(value, min, max) : fallback;
}
