/**
 * Gerenciador de entrada. Usa `KeyboardEvent.code` (posição física da tecla),
 * permitindo que dois jogadores usem o mesmo teclado sem conflito.
 */

export interface InputManager {
  isDown: (codes: readonly string[]) => boolean;
  /** Verdadeiro apenas no frame em que a tecla foi pressionada. */
  wasPressed: (codes: readonly string[]) => boolean;
  readonly mouse: Readonly<{ x: number; y: number; down: boolean; moved: boolean }>;
  endFrame: () => void;
  destroy: () => void;
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Enter', 'NumpadEnter', 'Numpad0', 'Numpad1', 'ShiftRight', 'Escape', 'KeyP'
]);

export function createInput(canvas: HTMLCanvasElement, worldWidth: number, worldHeight: number): InputManager {
  const down = new Set<string>();
  const pressed = new Set<string>();
  const mouse = { x: worldWidth / 2, y: worldHeight / 2, down: false, moved: false };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    down.delete(e.code);
  };
  const onBlur = (): void => {
    down.clear();
    mouse.down = false;
  };
  const toWorld = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * worldWidth;
    const y = ((e.clientY - rect.top) / rect.height) * worldHeight;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      mouse.x = Math.max(0, Math.min(worldWidth, x));
      mouse.y = Math.max(0, Math.min(worldHeight, y));
      mouse.moved = true;
    }
  };
  const onMouseMove = (e: MouseEvent): void => toWorld(e);
  const onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) {
      toWorld(e);
      mouse.down = true;
    }
  };
  const onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) mouse.down = false;
  };
  const onContext = (e: Event): void => e.preventDefault();

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContext);

  const anyIn = (set: Set<string>, codes: readonly string[]): boolean => {
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code !== undefined && set.has(code)) return true;
    }
    return false;
  };

  return {
    isDown: (codes) => anyIn(down, codes),
    wasPressed: (codes) => anyIn(pressed, codes),
    mouse,
    endFrame: () => pressed.clear(),
    destroy: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContext);
    }
  };
}
