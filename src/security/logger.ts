/**
 * Logger seguro (camada de observabilidade).
 * - Mantém um buffer circular interno que nunca é exposto no objeto global.
 * - Em produção imprime apenas códigos genéricos, sem stack traces, estruturas internas ou tokens.
 * - Mascara padrões sensíveis (token, key, secret, password, bearer) antes de armazenar.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  readonly time: number;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
}

const MAX_ENTRIES = 200;
const IS_PROD: boolean = import.meta.env.PROD;
const SENSITIVE = /(token|api[_-]?key|secret|password|senha|bearer|authorization)\s*[:=]?\s*\S+/gi;

const buffer: LogEntry[] = [];
let errorCounter = 0;

function redact(value: string): string {
  return value.replace(SENSITIVE, '$1=[REDACTED]').slice(0, 300);
}

function describe(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail);
  return '';
}

function push(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  const text = redact(detail === undefined ? message : `${message} | ${describe(detail)}`);
  const entry: LogEntry = Object.freeze({ time: Date.now(), level, scope: redact(scope), message: text });
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();

  if (!IS_PROD) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
    fn(`[GDG:${entry.scope}] ${entry.message}`);
    return;
  }
  if (level === 'error') {
    errorCounter += 1;
    // Produção: código genérico, sem detalhes internos.
    console.warn(`[GDG] Erro interno registrado (#${errorCounter}).`);
  }
}

export const logger = Object.freeze({
  debug: (scope: string, message: string, detail?: unknown): void => {
    if (!IS_PROD) push('debug', scope, message, detail);
  },
  info: (scope: string, message: string, detail?: unknown): void => push('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown): void => push('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: unknown): void => push('error', scope, message, detail),
  /** Cópia imutável dos últimos registros (para telas de diagnóstico internas). */
  snapshot: (): readonly LogEntry[] => Object.freeze(buffer.slice())
});

let handlersInstalled = false;

/** Captura exceções globais sem deixar vazar detalhes ao console público. */
export function installGlobalErrorHandlers(): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  window.addEventListener('error', (event: ErrorEvent) => {
    logger.error('window', 'Exceção não tratada', event.error ?? event.message);
    if (IS_PROD) event.preventDefault();
  });
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logger.error('promise', 'Promise rejeitada sem tratamento', event.reason);
    if (IS_PROD) event.preventDefault();
  });
}
