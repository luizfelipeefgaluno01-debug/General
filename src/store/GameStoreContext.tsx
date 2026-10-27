import { createContext, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createGameStore, type GameStore } from './gameStore';
import type { GameStoreState } from '../types/game';

const GameStoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ children }: { children: ReactNode }): ReactNode {
  const storeRef = useRef<GameStore | null>(null);
  if (storeRef.current === null) storeRef.current = createGameStore();
  return <GameStoreContext.Provider value={storeRef.current}>{children}</GameStoreContext.Provider>;
}

export function useGameStoreApi(): GameStore {
  const store = useContext(GameStoreContext);
  if (store === null) throw new Error('useGameStoreApi deve ser usado dentro de <GameStoreProvider>');
  return store;
}

/** Assina uma fatia do estado. O seletor deve retornar referências estáveis. */
export function useGameStore<T>(selector: (state: Readonly<GameStoreState>) => T): T {
  const store = useGameStoreApi();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

export function useGameActions(): GameStore['actions'] {
  return useGameStoreApi().actions;
}
