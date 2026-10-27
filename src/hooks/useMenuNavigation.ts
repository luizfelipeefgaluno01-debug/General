import { useCallback, useEffect, useRef } from 'react';

/**
 * Navegação de menu por teclado: Setas ↑/↓ movem o foco, Enter ativa o item focado
 * (comportamento nativo de <button>). Em campos de texto, Enter avança para o próximo item.
 * O mouse também move o foco ao passar por cima, mantendo os dois modos sincronizados.
 */
export function useMenuNavigation(screenKey: string): {
  register: (index: number) => (el: HTMLElement | null) => void;
  hover: (index: number) => () => void;
} {
  const items = useRef<(HTMLElement | null)[]>([]);

  const focusAt = useCallback((index: number): void => {
    const list = items.current.filter((el): el is HTMLElement => el !== null && !el.hasAttribute('disabled'));
    if (list.length === 0) return;
    const i = ((index % list.length) + list.length) % list.length;
    list[i]?.focus();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => focusAt(0), 30);
    const onKey = (e: KeyboardEvent): void => {
      const list = items.current.filter((el): el is HTMLElement => el !== null);
      const current = list.findIndex((el) => el === document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusAt(current + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusAt(current < 0 ? list.length - 1 : current - 1);
      } else if (e.key === 'Enter' && document.activeElement instanceof HTMLInputElement) {
        e.preventDefault();
        focusAt(current + 1);
      } else if (current < 0 && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        focusAt(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [screenKey, focusAt]);

  const register = useCallback(
    (index: number) => (el: HTMLElement | null): void => {
      items.current[index] = el;
    },
    []
  );

  const hover = useCallback(
    (index: number) => (): void => {
      items.current[index]?.focus();
    },
    []
  );

  return { register, hover };
}
