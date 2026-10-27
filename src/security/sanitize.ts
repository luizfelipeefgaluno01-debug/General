/**
 * Validação e sanitização de entradas (camada de input).
 * Usada para nomes de jogadores, nomes de salas e qualquer texto exibido no DOM ou no Canvas.
 */
import type { AimMode, GameMode, GameSettings } from '../types/game';
import { logger } from './logger';

export interface SanitizeOptions {
  maxLength?: number;
  fallback?: string;
}

// Letras (inclui acentos), números, espaço, hífen, sublinhado e ponto.
const DISALLOWED = /[^\p{L}\p{N} _.-]/gu;
// Caracteres de controle e invisíveis (bidi override, zero-width etc.).
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

/**
 * Remove marcação HTML, protocolos perigosos, caracteres de controle e qualquer símbolo
 * fora da lista permitida. Sempre retorna uma string segura e limitada em tamanho.
 */
export function sanitizeInput(raw: unknown, options: SanitizeOptions = {}): string {
  const maxLength = options.maxLength ?? 16;
  const fallback = options.fallback ?? '';
  if (typeof raw !== 'string') return fallback;

  const original = raw.slice(0, 256); // limita custo de processamento
  const cleaned = original
    .normalize('NFKC')
    .replace(/<[^>]*>?/g, '') // tags HTML
    .replace(/(javascript|data|vbscript)\s*:/gi, '') // protocolos
    .replace(/on\w+\s*=/gi, '') // handlers inline
    .replace(CONTROL, '')
    .replace(DISALLOWED, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLength);

  if (cleaned !== original.slice(0, maxLength)) {
    logger.warn('sanitize', 'Entrada continha caracteres não permitidos e foi limpa');
  }
  return cleaned;
}

/** Versão para valores finais (remove espaços nas pontas e aplica fallback se vazio). */
export function sanitizeName(raw: unknown, fallback: string): string {
  const value = sanitizeInput(raw, { maxLength: 12 }).trim();
  return value.length > 0 ? value : fallback;
}

/** Nome de sala multiplayer: apenas A-Z, 0-9 e hífen, em maiúsculas. */
export function sanitizeRoomName(raw: unknown): string {
  return sanitizeInput(raw, { maxLength: 20 }).toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

const MODES: readonly GameMode[] = ['single', 'coop', 'versus'];
const AIMS: readonly AimMode[] = ['mouse', 'keyboard'];

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  mode: 'single',
  p1Name: 'GENERAL',
  p2Name: 'CORONEL',
  aimMode: 'mouse',
  sound: true
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Valida um objeto desconhecido (ex.: vindo do localStorage) e devolve configurações seguras. */
export function validateSettings(value: unknown): GameSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  const mode = MODES.find((m) => m === value['mode']) ?? DEFAULT_SETTINGS.mode;
  const aimMode = AIMS.find((a) => a === value['aimMode']) ?? DEFAULT_SETTINGS.aimMode;
  return {
    mode,
    aimMode,
    p1Name: sanitizeName(value['p1Name'], DEFAULT_SETTINGS.p1Name),
    p2Name: sanitizeName(value['p2Name'], DEFAULT_SETTINGS.p2Name),
    sound: typeof value['sound'] === 'boolean' ? value['sound'] : DEFAULT_SETTINGS.sound
  };
}

const STORAGE_KEY = 'gdg.settings.v1';

export function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw.length > 2048) return { ...DEFAULT_SETTINGS };
    return validateSettings(JSON.parse(raw) as unknown);
  } catch (err) {
    logger.warn('storage', 'Falha ao ler configurações; usando padrão', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validateSettings(settings)));
  } catch (err) {
    logger.warn('storage', 'Falha ao salvar configurações', err);
  }
}
