import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../security/logger';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/** Captura falhas de renderização e mostra uma tela temática (sem expor detalhes internos). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('react', 'Falha de renderização', error);
    logger.debug('react', 'Pilha de componentes', info.componentStack ?? '');
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="screen error-screen">
          <h2 className="overlay-title">FALHA NA COMUNICAÇÃO</h2>
          <p>O QUARTEL-GENERAL PERDEU O SINAL.</p>
          <button type="button" className="menu-item" onClick={() => window.location.reload()}>
            <span className="menu-cursor" aria-hidden="true">▶</span>
            <span className="menu-label">RECONECTAR</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
