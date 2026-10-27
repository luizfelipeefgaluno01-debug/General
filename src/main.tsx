import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import './styles/global.css';
import { App } from './App';
import { GameStoreProvider } from './store/GameStoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorHandlers, logger } from './security/logger';

installGlobalErrorHandlers();

const container = document.getElementById('root');
if (container === null) {
  logger.error('boot', 'Elemento #root não encontrado');
} else {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <GameStoreProvider>
          <App />
        </GameStoreProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
